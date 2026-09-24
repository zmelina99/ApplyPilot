import { sql } from 'drizzle-orm';
import { createDb } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { testDatabaseUrl } from '../src/config/env.js';

/**
 * Runs ONCE before the whole suite. Brings the isolated test database to a clean,
 * fully-migrated state regardless of what a previous (possibly interrupted) run left
 * behind — dropping our own tables + enums and the drizzle bookkeeping schema, then
 * re-applying migrations. This is why "migrations succeed on an empty database" is a
 * real, exercised guarantee, and why individual test files no longer each migrate.
 *
 * Only objects owned by the app role are touched (no privileged schema drop).
 */
export default async function setup(): Promise<void> {
  const { db, close } = createDb(testDatabaseUrl());
  try {
    await db.execute(
      sql.raw(`DO $$
        DECLARE r record;
        BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname='public') LOOP
            EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
          FOR r IN (
            SELECT t.typname FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname='public' AND t.typtype='e'
          ) LOOP
            EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
          END LOOP;
        END $$;`),
    );
    await db.execute(sql.raw('DROP SCHEMA IF EXISTS drizzle CASCADE'));
    await runMigrations(db);
  } finally {
    await close();
  }
}
