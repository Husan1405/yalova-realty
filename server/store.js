import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as github from './github.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_FILE = path.join(__dirname, 'catalog.json');
// Путь файла в GitHub-репо (корень, чтобы публичный URL был коротким).
const REMOTE_PATH = 'catalog.json';

let cache = null;
let writePromise = Promise.resolve();

// Источник истины — GitHub (если настроен): локальный файл — лишь оффлайн-кэш.
// Это критично: бот может работать с разных машин, и каждая из них при старте
// читала только свой локальный файл и потом затирала remote своим устаревшим
// состоянием. Теперь перед каждой операцией мы синхронизируемся с remote.
async function readLocal() {
  try {
    const raw = await fs.readFile(CATALOG_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('catalog read error:', e);
    return [];
  }
}

async function pullRemote() {
  if (!github.isEnabled()) return null;
  try {
    const raw = await github.getFile(REMOTE_PATH);
    if (raw == null) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch (e) {
    console.warn('GitHub pull failed:', e.message);
    return null;
  }
}

async function syncFromRemote() {
  const remote = await pullRemote();
  if (remote == null) return; // GitHub недоступен — оставляем cache как есть
  cache = remote;
  try {
    await fs.writeFile(CATALOG_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    console.warn('local catalog write failed:', e.message);
  }
}

async function load(forceRemote = false) {
  if (cache && !forceRemote) return cache;
  // 1) сперва пробуем GitHub — единственный достоверный источник между узлами
  const remote = await pullRemote();
  if (remote != null) {
    cache = remote;
    try {
      await fs.writeFile(CATALOG_FILE, JSON.stringify(cache, null, 2), 'utf8');
    } catch (e) {
      console.warn('local catalog write failed:', e.message);
    }
    return cache;
  }
  // 2) фолбэк на локальный файл
  cache = await readLocal();
  return cache;
}

async function pushRemote() {
  if (!github.isEnabled()) return;
  try {
    const data = JSON.stringify(cache, null, 2);
    await github.putFile(REMOTE_PATH, data, 'update catalog.json');
    await github.purge([REMOTE_PATH]);
  } catch (e) {
    console.warn('GitHub sync failed:', e.message);
  }
}

async function persist() {
  const data = JSON.stringify(cache, null, 2);
  writePromise = writePromise
    .then(() => fs.writeFile(CATALOG_FILE, data, 'utf8'))
    .then(() => pushRemote());
  return writePromise;
}

export async function list() {
  await syncFromRemote();
  return [...(await load())];
}

export async function get(id) {
  await syncFromRemote();
  const all = await load();
  return all.find((a) => a.id === id) || null;
}

export async function add(apartment) {
  // Перед записью обязательно подтягиваем актуальный remote-список,
  // иначе мы могли бы запушить устаревший cache и потерять чужие записи.
  await syncFromRemote();
  const all = await load();
  const id = String(Date.now()) + Math.random().toString(36).slice(2, 6);
  const record = { id, createdAt: new Date().toISOString(), ...apartment };
  all.push(record);
  cache = all;
  await persist();
  return record;
}

export async function update(id, patch) {
  await syncFromRemote();
  const all = await load();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, id };
  cache = all;
  await persist();
  return all[idx];
}

export async function remove(id) {
  await syncFromRemote();
  const all = await load();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  all.splice(idx, 1);
  cache = all;
  await persist();
  return true;
}

// Прямо переписывает массив целиком (используется миграцией).
export async function replaceAll(items) {
  cache = Array.isArray(items) ? items : [];
  await persist();
  return cache;
}
