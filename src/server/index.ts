import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createAppDb } from '../db/client.js';
import { createApiApp } from './api.js';
import { isEntrypoint } from '../util/entrypoint.js';

const PORT = Number(process.env['API_PORT'] ?? 4000);

/** Start the API server. In dev, Vite serves the client and proxies /api here.
 * If a production client build exists (web/dist), it is served from this same
 * process so `npm run build && npm start` runs single-process. */
export async function startServer(): Promise<void> {
  const { db } = createAppDb();
  const app = createApiApp(db);

  const dist = path.resolve('web/dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`ApplyPilot API listening on http://localhost:${PORT}`);
    if (existsSync(dist)) console.log(`Serving built UI from ${dist}`);
  });
}

if (isEntrypoint(import.meta.url)) {
  startServer().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
