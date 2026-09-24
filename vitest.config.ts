import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests share ONE PostgreSQL test database, so files must not run in parallel
    // (each file truncates between tests; concurrent files would clobber each other).
    // The schema is migrated once up front by globalSetup.
    fileParallelism: false,
    sequence: { concurrent: false },
    // Clean + migrate the shared test DB exactly once, before any file runs.
    globalSetup: ['./tests/globalSetup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ['tests/**/*.test.ts'],
  },
});
