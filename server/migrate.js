// Одноразовая миграция: если в catalog.json у фото лежат file_id (старый формат) —
// скачиваем их из Telegram и заливаем в GitHub, сохраняем уже постоянные URL.

import * as github from './github.js';
import * as store from './store.js';
import { uploadPhotoArray, isPhotoUrl } from './photos.js';

export async function migrateExistingPhotos(bot) {
  if (!github.isEnabled()) return { skipped: true };

  const list = await store.list();
  if (list.length === 0) return { migrated: 0 };

  let touched = 0;
  const updated = [];
  for (const item of list) {
    const photos = item.photos || [];
    const needsMigration = photos.some((p) => !isPhotoUrl(p));
    if (!needsMigration) {
      updated.push(item);
      continue;
    }
    try {
      const newPhotos = await uploadPhotoArray(bot, photos);
      updated.push({ ...item, photos: newPhotos });
      touched += 1;
    } catch (e) {
      console.warn(`migrate: photo upload failed for ${item.id}:`, e.message);
      updated.push(item);
    }
  }

  if (touched > 0) {
    await store.replaceAll(updated);
    console.log(`migrate: updated ${touched} apartment(s) with GitHub photo URLs`);
  } else {
    console.log('migrate: nothing to migrate');
  }
  return { migrated: touched };
}
