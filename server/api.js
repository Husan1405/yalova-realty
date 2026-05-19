import express from 'express';
import cors from 'cors';
import * as store from './store.js';

const TYPE_MAP = { 'квартира': 'apartment', 'вилла': 'villa', 'участок': 'land' };
const STATUS_MAP = { 'продажа': 'sale', 'аренда': 'rent' };

function toFrontend(a) {
  return {
    id: a.id,
    type: TYPE_MAP[a.type] || a.type,
    status: STATUS_MAP[a.status] || a.status,
    title: a.title || '',
    description: a.description || '',
    price: a.price || '',
    area: a.area || '',
    rooms: a.rooms || '',
    photos: a.photos || [],
  };
}

export function createApi(bot) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.get('/api/apartments', async (req, res) => {
    try {
      const all = await store.list();
      res.json(all.map(toFrontend));
    } catch (e) {
      console.error('apartments error:', e);
      res.status(500).json({ error: 'internal' });
    }
  });

  app.get('/api/photo/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    try {
      const link = await bot.telegram.getFileLink(fileId);
      const upstream = await fetch(link.href);
      if (!upstream.ok) {
        return res.status(upstream.status).end();
      }
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      const reader = upstream.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (e) {
      console.error('photo proxy error:', e?.description || e?.message || e);
      res.status(404).end();
    }
  });

  return app;
}
