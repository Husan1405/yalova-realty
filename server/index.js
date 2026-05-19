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

async function start() {
  if (BASE_URL) {
    const webhookPath = `/tg/${WEBHOOK_SECRET}`;
    app.use(bot.webhookCallback(webhookPath));
    await bot.telegram.setWebhook(`${BASE_URL}${webhookPath}`);
    app.listen(PORT, () => console.log(`HTTP listening on :${PORT}, webhook ${BASE_URL}${webhookPath}`));
  } else {
    await bot.telegram.deleteWebhook().catch(() => {});
    bot.launch();
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

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
