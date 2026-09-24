import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit config for schema → SQL migration generation.
 * `db:generate` diffs the schema and writes SQL to ./drizzle (no DB connection).
 * A DATABASE_URL is only needed for commands that touch the database.
 */
export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/applypilot_dev',
  },
  strict: true,
  verbose: true,
});
