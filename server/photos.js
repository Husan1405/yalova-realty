// Скачивает фото из Telegram по file_id и заливает на GitHub.
// Возвращает публичный jsDelivr URL.

import crypto from 'node:crypto';
import * as github from './github.js';

function isUrl(s) {
  return typeof s === 'string' && /^https?:\/\//i.test(s);
}

function randName(ext = 'jpg') {
  return `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
}

// Берёт file_id из Telegram, скачивает байты.
async function fetchTelegramPhoto(bot, fileId) {
  const link = await bot.telegram.getFileLink(fileId);
  const res = await fetch(link.href);
  if (!res.ok) throw new Error(`Telegram photo ${fileId}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Telegram presigned ссылки заканчиваются на /photos/file_<n>.jpg
  const ext = (link.pathname.split('.').pop() || 'jpg').toLowerCase().slice(0, 4);
  return { buf, ext };
}

// Загружает одно фото (если это file_id) и возвращает URL.
// Если уже URL — возвращает как есть.
export async function uploadPhoto(bot, value) {
  if (isUrl(value)) return value;
  if (!github.isEnabled()) {
    // Без GitHub-конфига оставляем file_id — фронт фолбэкнется на /api/photo.
    return value;
  }
  const { buf, ext } = await fetchTelegramPhoto(bot, value);
  const path = `photos/${randName(ext)}`;
  await github.putFile(path, buf, `add photo ${path}`);
  return github.publicUrl(path);
}

// Загружает массив фото последовательно (избегаем гонок sha на GitHub).
export async function uploadPhotoArray(bot, photos) {
  const out = [];
  for (const p of photos || []) {
    try {
      out.push(await uploadPhoto(bot, p));
    } catch (e) {
      console.warn('photo upload failed, keeping original:', e.message);
      out.push(p);
    }
  }
  return out;
}

export const isPhotoUrl = isUrl;
