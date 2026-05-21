// Минимальный клиент GitHub Contents API + purge jsDelivr.
// Никаких внешних зависимостей: пользуется глобальным fetch (Node 18+).

const API = 'https://api.github.com';

function cfg() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  if (!token || !owner || !repo) return null;
  return { token, owner, repo, branch };
}

export function isEnabled() {
  return !!cfg();
}

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'yalova-realty-bot',
  };
}

// Возвращает sha файла на ветке или null, если файла нет.
async function getSha(path) {
  const c = cfg();
  if (!c) return null;
  const url = `${API}/repos/${c.owner}/${c.repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(c.branch)}`;
  const res = await fetch(url, { headers: headers(c.token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub getSha ${path}: HTTP ${res.status}`);
  const data = await res.json();
  return data.sha || null;
}

// Скачивает содержимое файла с ветки (как строку utf8). Возвращает null, если файла нет.
export async function getFile(path) {
  const c = cfg();
  if (!c) return null;
  const url = `${API}/repos/${c.owner}/${c.repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(c.branch)}`;
  const res = await fetch(url, { headers: headers(c.token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub getFile ${path}: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.content) return null;
  return Buffer.from(data.content, data.encoding || 'base64').toString('utf8');
}

// Создаёт или обновляет файл. content — Buffer | string.
export async function putFile(path, content, message) {
  const c = cfg();
  if (!c) throw new Error('GitHub config missing');
  const body = {
    message: message || `update ${path}`,
    content: Buffer.isBuffer(content)
      ? content.toString('base64')
      : Buffer.from(content, 'utf8').toString('base64'),
    branch: c.branch,
  };
  const sha = await getSha(path);
  if (sha) body.sha = sha;

  const url = `${API}/repos/${c.owner}/${c.repo}/contents/${encodeURI(path)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(c.token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub putFile ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
  }
  return res.json();
}

// Постоянный публичный URL через jsDelivr (CDN, поддерживает purge).
export function publicUrl(path) {
  const c = cfg();
  if (!c) return null;
  return `https://cdn.jsdelivr.net/gh/${c.owner}/${c.repo}@${c.branch}/${path}`;
}

// Принудительно сбрасывает кэш jsDelivr — обновление видно за секунды.
export async function purge(paths) {
  const c = cfg();
  if (!c) return;
  const list = Array.isArray(paths) ? paths : [paths];
  await Promise.all(list.map((p) =>
    fetch(`https://purge.jsdelivr.net/gh/${c.owner}/${c.repo}@${c.branch}/${p}`)
      .catch((e) => console.warn('jsDelivr purge failed for', p, e?.message))
  ));
}
