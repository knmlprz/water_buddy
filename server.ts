import { createServer as createViteServer } from 'vite';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { createApiApp } from './src/server/app';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = createApiApp();
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');

  if (!isProd || !fs.existsSync(distPath)) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WodaPol server listening on http://localhost:${PORT}`);
  });
}

startServer();
