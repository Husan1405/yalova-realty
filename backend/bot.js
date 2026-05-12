import { Telegraf, Markup } from 'telegraf';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'apartments.json');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Инициализация БД
async function initDatabase() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify([], null, 2));
  }
}

// Загрузить квартиры из JSON
async function loadApartments() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Error loading apartments:', e);
    return [];
  }
}

// Сохранить квартиры в JSON (в backend и синхронизировать с сайтом)
async function saveApartments(apartments) {
  try {
    await fs.writeFile(DB_PATH, JSON.stringify(apartments, null, 2));
  } catch (e) {
    console.error('Error saving apartments to backend DB:', e);
  }

  // Попытка синхронизации с фронтендом: записать в ../data/catalog.json и скачать фото в public/catalog
  try {
    const catalogPath = path.join(__dirname, '..', 'data', 'catalog.json');
    const publicCatalogDir = path.join(__dirname, '..', 'public', 'catalog');
    await fs.mkdir(path.dirname(catalogPath), { recursive: true });
    await fs.mkdir(publicCatalogDir, { recursive: true });

    const siteEntries = [];
    for (const a of apartments) {
      let imageUrl = a.image || null;
      // Если это телеграм-файл, постараемся скачать и сохранить локально
      if (imageUrl && imageUrl.includes('api.telegram.org/file')) {
        try {
          const resp = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          const ext = path.extname(imageUrl).split('?')[0] || '.jpg';
          const filename = `img_${a.id}${ext}`;
          const outPath = path.join(publicCatalogDir, filename);
          await fs.writeFile(outPath, resp.data);
          imageUrl = '/catalog/' + filename;
        } catch (e) {
          console.warn('Failed to download image for', a.id, e.message || e);
          // keep original URL as fallback
        }
      }

      siteEntries.push({
        id: a.id,
        title: a.title,
        type: a.type,
        status: a.status,
        price: a.price,
        desc: a.description || a.desc || '',
        image: imageUrl,
        createdAt: a.createdAt || new Date().toISOString()
      });
    }

    await fs.writeFile(catalogPath, JSON.stringify(siteEntries, null, 2));
    console.log('Synchronized catalog to', catalogPath);
  } catch (e) {
    console.error('Error syncing catalog to public site:', e);
  }
}

// Состояние диалога для каждого пользователя
const userStates = new Map();

// Главное меню
const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback('➕ Добавить квартиру', 'add_apartment')],
  [Markup.button.callback('📋 Просмотреть все', 'view_all')],
  [Markup.button.callback('🔍 Найти квартиру', 'search_apartment')],
  [Markup.button.callback('❌ Удалить квартиру', 'delete_apartment')],
  [Markup.button.url('🌐 Посетить сайт', 'https://nedvijimost-yalova.netlify.app/')]
]);

// Команда /start
bot.command('start', async (ctx) => {
  console.log('Received /start from', ctx.from.id);
  userStates.delete(ctx.from.id);
  await ctx.reply(
    '🏠 Добро пожаловать в бот управления каталогом квартир Ялова!\n\n' +
    'Просто перешлите пост из канала в этот чат, и бот добавит его в каталог!',
    mainMenu
  );
});

// === ОБРАБОТЧИК ПЕРЕСЛАННЫХ ПОСТОВ ===
async function handleForwardedPost(ctx) {
  const msg = ctx.message;
  const userId = ctx.from.id;

  try {
    let title = '', description = '', price = '', type = 'apartment', status = 'sale', rooms = null, area = null, image = null;

    if (msg.text) {
      const lines = msg.text.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        title = lines[0].trim();
        const priceMatch = msg.text.match(/(\$|€|₺)?[\d\s,]+[K]?|бесплатно|договор/gi);
        if (priceMatch) price = priceMatch[0].trim();
        if (msg.text.toLowerCase().includes('сдаё') || msg.text.toLowerCase().includes('аренд')) status = 'rent';
        if (msg.text.toLowerCase().includes('вилл')) type = 'villa';
        else if (msg.text.toLowerCase().includes('участок') || msg.text.toLowerCase().includes('земел')) type = 'land';
        const roomsMatch = msg.text.match(/(\d+)[\s-]?комн/gi);
        if (roomsMatch) rooms = roomsMatch[0].match(/\d+/)[0];
        const areaMatch = msg.text.match(/(\d+)[\s]*(?:м²|кв\.м|кв\.м\.)/gi);
        if (areaMatch) area = areaMatch[0].match(/\d+/)[0];
        description = lines.slice(1).join('\n').substring(0, 200);
      }
    }

    if (msg.photo && msg.photo.length > 0) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      const file = await ctx.telegram.getFile(fileId);
      image = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    }

    if (!title) return ctx.reply('❌ Ошибка: не удалось распознать название.');
    await confirmAndAddApartment(ctx, { title, description, price, type, status, rooms, area, image });
  } catch (e) {
    console.error(e);
    await ctx.reply('❌ Ошибка при обработке.');
  }
}

async function confirmAndAddApartment(ctx, apartmentData) {
  userStates.set(ctx.from.id, { step: 'awaiting_confirmation', apartmentData });
  const preview = `✨ *Распознанные данные:* \n*${apartmentData.title}*\nЦена: ${apartmentData.price}`;
  await ctx.reply(preview, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([
    [Markup.button.callback('✅ Добавить', 'confirm_add'), Markup.button.callback('✏️ Ред.', 'edit_apartment')],
    [Markup.button.callback('❌ Отмена', 'cancel')]
  ])});
}

bot.on('message', async (ctx) => {
  if (ctx.message.forward_from_chat) return handleForwardedPost(ctx);
  // Обработка обычного текста и состояний (упрощено для краткости)
});

bot.action('confirm_add', async (ctx) => {
  const state = userStates.get(ctx.from.id);
  if (!state || !state.apartmentData) return ctx.answerCbQuery('❌ Ошибка');
  const apartments = await loadApartments();
  apartments.push({ id: Date.now().toString(), ...state.apartmentData, createdAt: new Date().toISOString() });
  await saveApartments(apartments);
  userStates.delete(ctx.from.id);
  await ctx.editMessageText('✅ Квартира добавлена!', mainMenu);
});

bot.action('add_apartment', async (ctx) => {
  userStates.set(ctx.from.id, { step: 'awaiting_type' });
  await ctx.editMessageText(
    'Выберите тип объекта:',
    Markup.inlineKeyboard([
      [Markup.button.callback('🏠 Квартира', 'type_apartment')],
      [Markup.button.callback('🏡 Вилла', 'type_villa')],
      [Markup.button.callback('🌳 Земельный участок', 'type_land')],
      [Markup.button.callback('❌ Отмена', 'cancel')]
    ])
  );
});

bot.action('cancel', async (ctx) => {
  userStates.delete(ctx.from.id);
  await ctx.editMessageText('🏠 Главное меню:', mainMenu);
});

// === REST API ===
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/apartments', async (req, res) => res.json(await loadApartments()));

const PORT = process.env.PORT || 5000;
async function start() {
  await initDatabase();
  app.listen(PORT, () => console.log(`🌐 API Server running on http://localhost:${PORT}`));
  bot.launch();
  console.log('🤖 Bot started');
}

start().catch(console.error);
