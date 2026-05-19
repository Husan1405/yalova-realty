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

async function load() {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(CATALOG_FILE, 'utf8');
    cache = JSON.parse(raw);
    if (!Array.isArray(cache)) cache = [];
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('catalog read error:', e);
    cache = [];
  }
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
  return [...(await load())];
}

export async function get(id) {
  const all = await load();
  return all.find((a) => a.id === id) || null;
}

export async function add(apartment) {
  const all = await load();
  const id = String(Date.now()) + Math.random().toString(36).slice(2, 6);
  const record = { id, createdAt: new Date().toISOString(), ...apartment };
  all.push(record);
  await persist();
  return record;
}

export async function update(id, patch) {
  const all = await load();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, id };
  await persist();
  return all[idx];
}

export async function remove(id) {
  const all = await load();
  const idx = all.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  all.splice(idx, 1);
  await persist();
  return true;
}

// Прямо переписывает массив целиком (используется миграцией).
export async function replaceAll(items) {
  cache = Array.isArray(items) ? items : [];
  await persist();
  return cache;
}
