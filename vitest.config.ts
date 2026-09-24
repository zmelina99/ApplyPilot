import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests share one PostgreSQL test database; run files sequentially so
    // per-test truncation stays deterministic.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['tests/**/*.test.ts'],
  },
});
