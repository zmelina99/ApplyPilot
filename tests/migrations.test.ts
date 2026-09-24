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

describe('migrations', () => {
  let handle: DbHandle;

  beforeAll(() => {
    handle = createDb(testDatabaseUrl());
  });

  afterAll(async () => {
    // Leave the DB migrated for the other test files.
    await runMigrations(handle.db);
    await handle.close();
  });

  it('succeed on an empty database', async () => {
    // Fully reset: drop public schema AND the drizzle bookkeeping schema.
    await handle.db.execute(sql.raw('drop schema if exists drizzle cascade'));
    await handle.db.execute(sql.raw('drop schema if exists public cascade'));
    await handle.db.execute(sql.raw('create schema public'));

    await runMigrations(handle.db);

    const names = await tableNames(handle);
    for (const t of EXPECTED_TABLES) expect(names).toContain(t);
  });

  it('are safe to reapply through the normal migration mechanism', async () => {
    // Idempotent: applying again is a no-op and must not throw.
    await expect(runMigrations(handle.db)).resolves.not.toThrow();
    const names = await tableNames(handle);
    for (const t of EXPECTED_TABLES) expect(names).toContain(t);
  });
});
