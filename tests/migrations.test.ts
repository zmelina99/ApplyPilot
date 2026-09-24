import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb, type DbHandle } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { testDatabaseUrl } from '../src/config/env.js';

const EXPECTED_TABLES = [
  'users',
  'user_automation_settings',
  'jobs',
  'job_sources',
  'job_matches',
  'applications',
  'application_events',
  'review_items',
];

async function tableNames(handle: DbHandle): Promise<string[]> {
  const res = await handle.db.execute(
    sql.raw(
      `select table_name from information_schema.tables where table_schema='public' order by 1`,
    ),
  );
  return res.rows.map((r) => (r as { table_name: string }).table_name);
}

/**
 * The global setup (tests/globalSetup.ts) drops all app objects and runs migrations
 * from empty before any test file — so reaching this file already proves migrations
 * succeed on an empty database. These tests assert the resulting schema and that
 * re-applying migrations is a safe no-op. They do NOT drop the shared schema (that
 * would corrupt the database other test files rely on).
 */
describe('migrations', () => {
  let handle: DbHandle;

  beforeAll(() => {
    handle = createDb(testDatabaseUrl());
  });

  afterAll(async () => {
    await handle.close();
  });

  it('produced every expected table from an empty database', async () => {
    const names = await tableNames(handle);
    for (const t of EXPECTED_TABLES) expect(names).toContain(t);
  });

  it('are safe to reapply through the normal migration mechanism', async () => {
    await expect(runMigrations(handle.db)).resolves.not.toThrow();
    const names = await tableNames(handle);
    for (const t of EXPECTED_TABLES) expect(names).toContain(t);
  });
});
