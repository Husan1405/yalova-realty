import { Telegraf, Markup } from 'telegraf';
import { isAuthed, tryLogin, logout } from './session.js';
import * as store from './store.js';
import { parseCaption, missingFields, REQUIRED_FIELDS } from './parser.js';
import { uploadPhotoArray } from './photos.js';

const MAIN_MENU = Markup.keyboard([
  ['➕ Добавить', '📋 Список'],
  ['🗑 Удалить', '✏️ Редактировать'],
  ['🚪 Выйти'],
]).resize();

const TYPE_BUTTONS = Markup.inlineKeyboard([
  [Markup.button.callback('квартира', 'type:квартира')],
  [Markup.button.callback('вилла', 'type:вилла')],
  [Markup.button.callback('участок', 'type:участок')],
  [Markup.button.callback('❌ Отмена', 'flow:cancel')],
]);

const STATUS_BUTTONS = Markup.inlineKeyboard([
  [Markup.button.callback('продажа', 'status:продажа'), Markup.button.callback('аренда', 'status:аренда')],
  [Markup.button.callback('❌ Отмена', 'flow:cancel')],
]);

const EDIT_FIELD_BUTTONS = Markup.inlineKeyboard([
  [Markup.button.callback('Тип', 'editfield:type'), Markup.button.callback('Заголовок', 'editfield:title')],
  [Markup.button.callback('Цена', 'editfield:price'), Markup.button.callback('Статус', 'editfield:status')],
  [Markup.button.callback('Площадь', 'editfield:area'), Markup.button.callback('Комнаты', 'editfield:rooms')],
  [Markup.button.callback('Описание', 'editfield:description'), Markup.button.callback('Фото (заменить)', 'editfield:photos')],
  [Markup.button.callback('❌ Закрыть', 'flow:cancel')],
]);

const FIELD_LABELS = {
  type: 'Тип',
  title: 'Заголовок',
  price: 'Цена',
  status: 'Статус',
  area: 'Площадь',
  rooms: 'Комнаты',
  description: 'Описание',
};

// === state machine ===
// state = { mode, step, draft, missingQueue?, targetId? }
const state = new Map();
const getState = (id) => state.get(id) || null;
const setState = (id, s) => { if (s) state.set(id, s); else state.delete(id); };

// === media-group buffer ===
const mediaGroups = new Map();
// Альбом до 10 фото может прилетать с задержками между сообщениями: даём
// 2.5с тишины, чтобы дождаться всех фото даже на медленном соединении.
const MG_FLUSH_MS = 2500;

function formatDraft(d) {
  const lines = [];
  if (d.type) lines.push(`Тип: ${d.type}`);
  if (d.title) lines.push(`Заголовок: ${d.title}`);
  if (d.price) lines.push(`Цена: ${d.price}`);
  if (d.status) lines.push(`Статус: ${d.status}`);
  if (d.area) lines.push(`Площадь: ${d.area}`);
  if (d.rooms) lines.push(`Комнаты: ${d.rooms}`);
  if (d.description) lines.push(`\n${d.description}`);
  lines.push(`\nФото: ${(d.photos || []).length}`);
  return lines.join('\n');
}

function previewKeyboard(prefix) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Сохранить', `${prefix}:save`), Markup.button.callback('❌ Отмена', 'flow:cancel')],
  ]);
}

function askMissingPrompt(field) {
  switch (field) {
    case 'type': return ['Тип не указан. Выберите:', TYPE_BUTTONS];
    case 'status': return ['Статус не указан. Выберите:', STATUS_BUTTONS];
    case 'title': return ['Заголовок не указан. Пришлите текстом.', null];
    case 'price': return ['Цена не указана. Пришлите текстом (напр. "85000 USD").', null];
    default: return [`Поле "${field}" не заполнено. Пришлите текстом.`, null];
  }
}

async function endFlow(ctx, msg = 'Готово.') {
  setState(ctx.chat.id, null);
  await ctx.reply(msg, MAIN_MENU);
}

// === ADD flow ===
const ADD_STEPS = ['type', 'title', 'price', 'status', 'area', 'rooms', 'description', 'photos', 'confirm'];

async function startAdd(ctx) {
  setState(ctx.chat.id, { mode: 'add', step: 0, draft: { photos: [] } });
  await ctx.reply('Шаг 1/9. Тип объекта:', TYPE_BUTTONS);
}

async function nextAddStep(ctx, st) {
  st.step += 1;
  const field = ADD_STEPS[st.step];
  setState(ctx.chat.id, st);
  if (field === 'title') return ctx.reply('Шаг 2/9. Заголовок (например: "2+1 в центре Ялова"):');
  if (field === 'price') return ctx.reply('Шаг 3/9. Цена (например: "85000 USD"):');
  if (field === 'status') return ctx.reply('Шаг 4/9. Статус:', STATUS_BUTTONS);
  if (field === 'area') return ctx.reply('Шаг 5/9. Площадь м² (число или "—" чтобы пропустить):');
  if (field === 'rooms') return ctx.reply('Шаг 6/9. Комнаты (например "2+1" или "—"):');
  if (field === 'description') return ctx.reply('Шаг 7/9. Описание (или "—" чтобы пропустить):');
  if (field === 'photos') return ctx.reply('Шаг 8/9. Пришлите фото (можно несколько). Когда закончите — напишите "готово".');
  if (field === 'confirm') {
    return ctx.reply(`Шаг 9/9. Превью:\n\n${formatDraft(st.draft)}\n\nСохранить?`, previewKeyboard('add'));
  }
}

async function handleAddText(ctx, st) {
  const text = ctx.message.text.trim();
  const field = ADD_STEPS[st.step];
  if (field === 'title') { st.draft.title = text; return nextAddStep(ctx, st); }
  if (field === 'price') { st.draft.price = text; return nextAddStep(ctx, st); }
  if (field === 'area') { if (text !== '—') st.draft.area = text; return nextAddStep(ctx, st); }
  if (field === 'rooms') { if (text !== '—') st.draft.rooms = text; return nextAddStep(ctx, st); }
  if (field === 'description') { if (text !== '—') st.draft.description = text; return nextAddStep(ctx, st); }
  if (field === 'photos') {
    if (text.toLowerCase() === 'готово') return nextAddStep(ctx, st);
    return ctx.reply('Жду фото или "готово".');
  }
  await ctx.reply('Используйте кнопки или пришлите нужный текст. /cancel чтобы выйти.');
}

async function handleAddPhoto(ctx, st) {
  const field = ADD_STEPS[st.step];
  if (field !== 'photos') {
    return ctx.reply('Сейчас не нужно фото. Используйте текст / кнопки. /cancel чтобы выйти.');
  }
  const arr = ctx.message.photo;
  const largest = arr[arr.length - 1];
  st.draft.photos.push(largest.file_id);
  setState(ctx.chat.id, st);
  await ctx.reply(`📸 фото добавлено (всего: ${st.draft.photos.length}). Пришлите ещё или "готово".`);
}

// === DELETE flow ===
async function startDelete(ctx) {
  const list = await store.list();
  if (list.length === 0) return ctx.reply('Каталог пуст.', MAIN_MENU);
  setState(ctx.chat.id, { mode: 'delete', step: 0 });
  const text = list.map((a) => `• ${a.id} — ${a.title || '(без заголовка)'} — ${a.price || ''}`).join('\n');
  await ctx.reply(`Введите ID для удаления:\n\n${text}`);
}

async function handleDeleteText(ctx, st) {
  const text = ctx.message.text.trim();
  if (st.step === 0) {
    const a = await store.get(text);
    if (!a) return ctx.reply(`ID не найден: ${text}. Введите корректный ID или /cancel.`);
    st.step = 1; st.targetId = text;
    setState(ctx.chat.id, st);
    return ctx.reply(`Удалить "${a.title}" (ID ${a.id})?`, Markup.inlineKeyboard([
      [Markup.button.callback('✅ Да, удалить', 'delete:confirm'), Markup.button.callback('❌ Отмена', 'flow:cancel')],
    ]));
  }
}

// === EDIT flow ===
async function startEdit(ctx) {
  const list = await store.list();
  if (list.length === 0) return ctx.reply('Каталог пуст.', MAIN_MENU);
  setState(ctx.chat.id, { mode: 'edit', step: 0 });
  const text = list.map((a) => `• ${a.id} — ${a.title || '(без заголовка)'}`).join('\n');
  await ctx.reply(`Введите ID для редактирования:\n\n${text}`);
}

async function handleEditText(ctx, st) {
  const text = ctx.message.text.trim();
  if (st.step === 0) {
    const a = await store.get(text);
    if (!a) return ctx.reply(`ID не найден. Введите корректный ID или /cancel.`);
    st.step = 1; st.targetId = a.id; st.draft = { photos: [] };
    setState(ctx.chat.id, st);
    return ctx.reply(`Что редактируем в "${a.title}"?`, EDIT_FIELD_BUTTONS);
  }
  if (st.step === 2 && st.editField) {
    const field = st.editField;
    if (field === 'photos') {
      if (text.toLowerCase() === 'готово') {
        await ctx.reply('Загружаю фото в хранилище…');
        let urls = st.draft.photos;
        try {
          urls = await uploadPhotoArray({ telegram: ctx.telegram }, st.draft.photos);
        } catch (e) {
          console.warn('photo upload error:', e.message);
        }
        await store.update(st.targetId, { photos: urls });
        return endFlow(ctx, `Фото обновлены (${urls.length} шт.).`);
      }
      return ctx.reply('Пришлите фото или "готово".');
    }
    const patch = {};
    if (field === 'area' || field === 'rooms' || field === 'description') {
      if (text !== '—') patch[field] = text;
      else patch[field] = '';
    } else {
      patch[field] = text;
    }
    await store.update(st.targetId, patch);
    return endFlow(ctx, `Поле "${FIELD_LABELS[field]}" обновлено.`);
  }
}

async function handleEditPhoto(ctx, st) {
  if (st.step !== 2 || st.editField !== 'photos') {
    return ctx.reply('Сейчас не нужно фото. /cancel чтобы выйти.');
  }
  const arr = ctx.message.photo;
  const largest = arr[arr.length - 1];
  st.draft.photos.push(largest.file_id);
  setState(ctx.chat.id, st);
  await ctx.reply(`📸 (всего: ${st.draft.photos.length}). Ещё или "готово".`);
}

// === IMPORT flow (forwarded posts / direct photos with caption) ===
function processIncomingPhotos(ctx, photos, caption) {
  const parsed = parseCaption(caption);
  const draft = { ...parsed, photos };
  const missing = missingFields(draft);
  setState(ctx.chat.id, { mode: 'import', step: 0, draft, missingQueue: missing });
  return continueImportFlow(ctx);
}

async function continueImportFlow(ctx) {
  const st = getState(ctx.chat.id);
  if (!st || st.mode !== 'import') return;
  if (st.missingQueue && st.missingQueue.length > 0) {
    const field = st.missingQueue[0];
    st.editField = field;
    setState(ctx.chat.id, st);
    const [text, kb] = askMissingPrompt(field);
    return kb ? ctx.reply(text, kb) : ctx.reply(text);
  }
  return ctx.reply(`Превью:\n\n${formatDraft(st.draft)}\n\nСохранить?`, previewKeyboard('import'));
}

async function handleImportText(ctx, st) {
  const text = ctx.message.text.trim();
  if (st.missingQueue && st.missingQueue.length > 0) {
    const field = st.missingQueue[0];
    if (field === 'type' || field === 'status') {
      return ctx.reply('Используйте кнопки выше.');
    }
    st.draft[field] = text;
    st.missingQueue.shift();
    setState(ctx.chat.id, st);
    return continueImportFlow(ctx);
  }
}

function bufferMediaGroup(ctx) {
  const msg = ctx.message;
  if (!msg.photo) return false;
  const groupId = msg.media_group_id;
  if (!groupId) {
    const largest = msg.photo[msg.photo.length - 1];
    return { photos: [largest.file_id], caption: msg.caption || '' };
  }
  const key = `${ctx.chat.id}:${groupId}`;
  let entry = mediaGroups.get(key);
  if (!entry) {
    entry = { photos: [], caption: '', timeoutId: null, ctx };
    mediaGroups.set(key, entry);
  }
  const largest = msg.photo[msg.photo.length - 1];
  entry.photos.push(largest.file_id);
  if (msg.caption) entry.caption = msg.caption;
  clearTimeout(entry.timeoutId);
  entry.timeoutId = setTimeout(() => {
    mediaGroups.delete(key);
    processIncomingPhotos(entry.ctx, entry.photos, entry.caption).catch(console.error);
  }, MG_FLUSH_MS);
  return null;
}

// === createBot ===
export function createBot(token, password) {
  const bot = new Telegraf(token);

  // /start
  bot.start(async (ctx) => {
    if (isAuthed(ctx.chat.id)) {
      await ctx.reply('Вы вошли. Главное меню:', MAIN_MENU);
    } else {
      await ctx.reply('Здравствуйте! Введите пароль администратора одним сообщением.');
    }
  });

  // /cancel — глобальный сброс состояния
  bot.command('cancel', async (ctx) => {
    if (!isAuthed(ctx.chat.id)) return;
    setState(ctx.chat.id, null);
    await ctx.reply('Действие отменено.', MAIN_MENU);
  });

  // Inline callbacks
  bot.action('flow:cancel', async (ctx) => {
    setState(ctx.chat.id, null);
    await ctx.answerCbQuery('Отменено');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    await ctx.reply('Действие отменено.', MAIN_MENU);
  });

  bot.action(/^type:(.+)$/, async (ctx) => {
    if (!isAuthed(ctx.chat.id)) return ctx.answerCbQuery('Сначала войдите');
    const st = getState(ctx.chat.id);
    if (!st) return ctx.answerCbQuery('Нет активного действия');
    const value = ctx.match[1];
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    if (st.mode === 'add' && ADD_STEPS[st.step] === 'type') {
      st.draft.type = value; return nextAddStep(ctx, st);
    }
    if (st.mode === 'import' && st.missingQueue?.[0] === 'type') {
      st.draft.type = value; st.missingQueue.shift(); setState(ctx.chat.id, st);
      return continueImportFlow(ctx);
    }
    if (st.mode === 'edit' && st.step === 2 && st.editField === 'type') {
      await store.update(st.targetId, { type: value });
      return endFlow(ctx, 'Тип обновлён.');
    }
  });

  bot.action(/^status:(.+)$/, async (ctx) => {
    if (!isAuthed(ctx.chat.id)) return ctx.answerCbQuery('Сначала войдите');
    const st = getState(ctx.chat.id);
    if (!st) return ctx.answerCbQuery('Нет активного действия');
    const value = ctx.match[1];
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    if (st.mode === 'add' && ADD_STEPS[st.step] === 'status') {
      st.draft.status = value; return nextAddStep(ctx, st);
    }
    if (st.mode === 'import' && st.missingQueue?.[0] === 'status') {
      st.draft.status = value; st.missingQueue.shift(); setState(ctx.chat.id, st);
      return continueImportFlow(ctx);
    }
    if (st.mode === 'edit' && st.step === 2 && st.editField === 'status') {
      await store.update(st.targetId, { status: value });
      return endFlow(ctx, 'Статус обновлён.');
    }
  });

  bot.action('add:save', async (ctx) => {
    const st = getState(ctx.chat.id);
    if (!st || st.mode !== 'add') return ctx.answerCbQuery('Нет активного действия');
    await ctx.answerCbQuery('Загружаю фото…');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    try {
      st.draft.photos = await uploadPhotoArray(bot, st.draft.photos || []);
    } catch (e) {
      console.warn('photo upload error:', e.message);
    }
    const saved = await store.add(st.draft);
    return endFlow(ctx, `Сохранено. ID: ${saved.id}`);
  });

  bot.action('import:save', async (ctx) => {
    const st = getState(ctx.chat.id);
    if (!st || st.mode !== 'import') return ctx.answerCbQuery('Нет активного действия');
    await ctx.answerCbQuery('Загружаю фото…');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    try {
      st.draft.photos = await uploadPhotoArray(bot, st.draft.photos || []);
    } catch (e) {
      console.warn('photo upload error:', e.message);
    }
    const saved = await store.add(st.draft);
    return endFlow(ctx, `Сохранено из канала. ID: ${saved.id}`);
  });

  bot.action('delete:confirm', async (ctx) => {
    const st = getState(ctx.chat.id);
    if (!st || st.mode !== 'delete' || !st.targetId) return ctx.answerCbQuery('Нет активного действия');
    await store.remove(st.targetId);
    await ctx.answerCbQuery('Удалено');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    return endFlow(ctx, `Удалено: ${st.targetId}`);
  });

  bot.action(/^editfield:(.+)$/, async (ctx) => {
    const st = getState(ctx.chat.id);
    if (!st || st.mode !== 'edit' || st.step !== 1) return ctx.answerCbQuery('Нет активного действия');
    const field = ctx.match[1];
    st.editField = field; st.step = 2; st.draft = { photos: [] };
    setState(ctx.chat.id, st);
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    if (field === 'type') return ctx.reply('Новый тип:', TYPE_BUTTONS);
    if (field === 'status') return ctx.reply('Новый статус:', STATUS_BUTTONS);
    if (field === 'photos') return ctx.reply('Пришлите новые фото (старые будут заменены). Когда закончите — "готово".');
    return ctx.reply(`Новое значение для "${FIELD_LABELS[field]}":`);
  });

  // Menu buttons (work only when not in a flow)
  bot.hears('➕ Добавить', async (ctx) => {
    if (!isAuthed(ctx.chat.id)) return ctx.reply('Сначала введите пароль.');
    if (getState(ctx.chat.id)) return ctx.reply('Вы уже в процессе. Завершите или /cancel.');
    return startAdd(ctx);
  });

  bot.hears('📋 Список', async (ctx) => {
    if (!isAuthed(ctx.chat.id)) return ctx.reply('Сначала введите пароль.');
    const list = await store.list();
    if (list.length === 0) return ctx.reply('Каталог пуст.', MAIN_MENU);
    const lines = list.map((a) => `• ${a.id}\n   ${a.title || '(без заголовка)'} — ${a.price || ''} (${a.type || '?'}, ${a.status || '?'}) — фото: ${(a.photos || []).length}`);
    await ctx.reply(`Всего: ${list.length}\n\n${lines.join('\n')}`);
  });

  bot.hears('🗑 Удалить', async (ctx) => {
    if (!isAuthed(ctx.chat.id)) return ctx.reply('Сначала введите пароль.');
    if (getState(ctx.chat.id)) return ctx.reply('Вы уже в процессе. /cancel.');
    return startDelete(ctx);
  });

  bot.hears('✏️ Редактировать', async (ctx) => {
    if (!isAuthed(ctx.chat.id)) return ctx.reply('Сначала введите пароль.');
    if (getState(ctx.chat.id)) return ctx.reply('Вы уже в процессе. /cancel.');
    return startEdit(ctx);
  });

  bot.hears('🚪 Выйти', async (ctx) => {
    logout(ctx.chat.id);
    setState(ctx.chat.id, null);
    await ctx.reply('Сессия завершена. /start чтобы войти снова.', Markup.removeKeyboard());
  });

  // Photo messages: dispatch by current flow OR treat as import (forwarded post / direct upload with caption)
  bot.on('photo', async (ctx) => {
    if (!isAuthed(ctx.chat.id)) return ctx.reply('Сначала введите пароль.');
    const st = getState(ctx.chat.id);
    if (st?.mode === 'add') return handleAddPhoto(ctx, st);
    if (st?.mode === 'edit') return handleEditPhoto(ctx, st);
    // Otherwise: incoming import (forward or direct photo). Buffer media-groups.
    if (st && st.mode === 'import') {
      // already in an import flow: append photo and keep flow
      const arr = ctx.message.photo;
      const largest = arr[arr.length - 1];
      st.draft.photos.push(largest.file_id);
      setState(ctx.chat.id, st);
      return ctx.reply(`Добавлено фото (всего: ${st.draft.photos.length}).`);
    }
    const single = bufferMediaGroup(ctx);
    if (single) {
      return processIncomingPhotos(ctx, single.photos, single.caption);
    }
    // for media-group, flush is scheduled in buffer
  });

  // Text messages
  bot.on('text', async (ctx) => {
    const chatId = ctx.chat.id;
    if (!isAuthed(chatId)) {
      const res = tryLogin(chatId, ctx.message.text.trim(), password);
      if (res.ok) return ctx.reply('Вход выполнен. Главное меню:', MAIN_MENU);
      if (res.lockedFor) return ctx.reply(`Слишком много попыток. Подождите ${res.lockedFor}с.`);
      return ctx.reply('Неверный пароль. Попробуйте ещё раз.');
    }
    const st = getState(chatId);
    if (!st) return ctx.reply('Команда не распознана. Используйте меню.', MAIN_MENU);
    if (st.mode === 'add') return handleAddText(ctx, st);
    if (st.mode === 'delete') return handleDeleteText(ctx, st);
    if (st.mode === 'edit') return handleEditText(ctx, st);
    if (st.mode === 'import') return handleImportText(ctx, st);
  });

  return bot;
}
