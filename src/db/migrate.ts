import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb, type Database } from './client.js';
import { databaseUrl } from '../config/env.js';
import { isEntrypoint } from '../util/entrypoint.js';

const MIGRATIONS_FOLDER = 'drizzle';

/**
 * Apply all pending migrations to a database. Idempotent: Drizzle records applied
 * migrations in its own bookkeeping table, so re-running is a safe no-op.
 */
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

/** CLI entry: migrate the DATABASE_URL target. */
export async function migrateAppDatabase(): Promise<void> {
  const handle = createDb(databaseUrl());
  try {
    await runMigrations(handle.db);
  } finally {
    await handle.close();
  }
}

// Executed directly (npm run db:migrate)
if (isEntrypoint(import.meta.url)) {
  migrateAppDatabase()
    .then(() => {
      console.log('Migrations applied.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
