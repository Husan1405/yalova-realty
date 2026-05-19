import crypto from 'node:crypto';

const TTL_MS = 24 * 60 * 60 * 1000;
const sessions = new Map();
const failures = new Map();

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isAuthed(chatId) {
  const s = sessions.get(chatId);
  if (!s) return false;
  if (Date.now() - s.authedAt > TTL_MS) {
    sessions.delete(chatId);
    return false;
  }
  return true;
}

export function logout(chatId) {
  sessions.delete(chatId);
}

export function tryLogin(chatId, password, expected) {
  const f = failures.get(chatId) || { count: 0, lockUntil: 0 };
  if (f.lockUntil > Date.now()) {
    return { ok: false, lockedFor: Math.ceil((f.lockUntil - Date.now()) / 1000) };
  }
  if (timingSafeEqualStr(password, expected)) {
    sessions.set(chatId, { authedAt: Date.now() });
    failures.delete(chatId);
    return { ok: true };
  }
  f.count += 1;
  if (f.count >= 3) {
    f.lockUntil = Date.now() + 60 * 1000;
    f.count = 0;
  }
  failures.set(chatId, f);
  return { ok: false };
}
