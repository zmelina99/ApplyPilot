import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Backend tests share ONE PostgreSQL test database, so files must not run in
    // parallel. The schema is migrated once up front by globalSetup.
    fileParallelism: false,
    sequence: { concurrent: false },
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/vitest.setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Node by default (DB tests); React component tests opt into jsdom per-file with
    // `// @vitest-environment jsdom`.
    include: ['tests/**/*.test.ts', 'web/**/*.test.tsx'],
  },
});
