import { sql } from 'drizzle-orm';
import { createDb, type Database, type DbHandle } from '../../src/db/client.js';
import { runMigrations } from '../../src/db/migrate.js';
import { testDatabaseUrl } from '../../src/config/env.js';

/**
 * Open a handle to the ISOLATED test database (TEST_DATABASE_URL) and ensure the
 * schema is migrated. env.ts refuses to fall back to DATABASE_URL, so tests can
 * never run against the dev database.
 */
export async function openTestDb(): Promise<DbHandle> {
  const handle = createDb(testDatabaseUrl());
  await runMigrations(handle.db);
  return handle;
}

/** All tables, ordered so a plain TRUNCATE … CASCADE is unambiguous. */
const ALL_TABLES = [
  'application_events',
  'applications',
  'review_items',
  'job_matches',
  'job_sources',
  'jobs',
  'user_automation_settings',
  'users',
];

/** Wipe all rows between tests for isolation. */
export async function resetDb(db: Database): Promise<void> {
  await db.execute(
    sql.raw(`truncate table ${ALL_TABLES.join(', ')} restart identity cascade`),
  );
}
