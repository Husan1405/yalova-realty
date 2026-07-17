import 'dotenv/config';
import { createBot } from './bot.js';
import { createApi } from './api.js';
import { migrateExistingPhotos } from './migrate.js';
import * as github from './github.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = process.env.BASE_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'tg-webhook';

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN is required in .env');
  process.exit(1);
}
if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD is required in .env');
  process.exit(1);
}

const bot = createBot(BOT_TOKEN, ADMIN_PASSWORD);
const app = createApi(bot);

let shuttingDown = false;
let retryTimer = null;

// Запуск polling с ретраем при транзиентном 409 (Conflict: terminated by other
// getUpdates request). Такое случается на хостинге в момент пере-деплоя, когда
// Telegram ещё несколько секунд держит прежний long-poll. Раньше bot.launch()
// без catch давал unhandledRejection → краш. Теперь — контролируемый ретрай,
// но с ЧИСТЫМ завершением по SIGTERM (см. shutdown), чтобы старый инстанс на
// Render не оставался «бессмертным» и не блокировал новый.
function launchWithRetry(attempt = 0) {
  if (shuttingDown) return;
  bot.launch().catch((e) => {
    if (shuttingDown) return;
    const delay = Math.min(3000 + attempt * 2000, 20000);
    console.warn(`bot.launch failed (${e?.message}); retry in ${delay}ms`);
    retryTimer = setTimeout(() => launchWithRetry(attempt + 1), delay);
  });
}

async function start() {
  if (BASE_URL) {
    const webhookPath = `/tg/${WEBHOOK_SECRET}`;
    app.use(bot.webhookCallback(webhookPath));
    await bot.telegram.setWebhook(`${BASE_URL}${webhookPath}`);
    app.listen(PORT, () => console.log(`HTTP listening on :${PORT}, webhook ${BASE_URL}${webhookPath}`));
  } else {
    await bot.telegram.deleteWebhook().catch(() => {});
    launchWithRetry();
    console.log('Bot started in polling mode');
    app.listen(PORT, () => console.log(`HTTP listening on http://localhost:${PORT}`));
  }

  if (github.isEnabled()) {
    console.log('GitHub sync enabled — running photo migration if needed');
    migrateExistingPhotos(bot).catch((e) => console.warn('migration failed:', e.message));
  } else {
    console.log('GitHub sync DISABLED — set GITHUB_TOKEN/GITHUB_OWNER/GITHUB_REPO in .env');
  }
}

start().catch((e) => {
  console.error('startup error:', e);
  process.exit(1);
});

// Корректное завершение: гарантированно останавливаем polling и ВЫХОДИМ из
// процесса. Без этого HTTP-сервер и таймер ретрая держали бы процесс живым,
// и при пере-деплое на Render старый инстанс продолжал бы поллить, вечно
// конфликтуя (409) с новым.
function shutdown(sig) {
  shuttingDown = true;
  if (retryTimer) clearTimeout(retryTimer);
  try { bot.stop(sig); } catch {}
  process.exit(0);
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
