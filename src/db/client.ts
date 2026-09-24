import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index.js';
import { databaseUrl } from '../config/env.js';

export type Database = NodePgDatabase<typeof schema>;

/** The transaction handle Drizzle passes to `db.transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Anything that can run queries: the pooled database or an open transaction.
 * Repository functions accept this so the same code works inside or outside a
 * transaction.
 */
export type Exec = Database | Tx;

export interface DbHandle {
  db: Database;
  pool: Pool;
  close: () => Promise<void>;
}

/**
 * Create a Drizzle client for a given connection string. Kept as a factory so the
 * app (DATABASE_URL) and the test suite (TEST_DATABASE_URL) use identical code with
 * different targets. Credentials are never hardcoded — the URL is the only input.
 */
export function createDb(connectionString: string): DbHandle {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return {
    db,
    pool,
    close: async () => {
      await pool.end();
    },
  };
}

/** Default application handle, bound to DATABASE_URL. */
export function createAppDb(): DbHandle {
  return createDb(databaseUrl());
}

export { schema };
