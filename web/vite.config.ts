import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React client. In dev, /api is proxied to the Express API (tsx) so the whole
// app runs from one `npm run dev`. Build output goes to web/dist, which the API
// server can serve single-process in production.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
