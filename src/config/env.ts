import 'dotenv/config';

/**
 * Central environment access. The application NEVER hardcodes credentials — the
 * database connection string always comes from DATABASE_URL (or TEST_DATABASE_URL
 * when running the test suite). The same code therefore runs against a local
 * PostgreSQL in development and a managed PostgreSQL in production, unchanged.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Set it in .env (see .env.example). Example: ` +
        `${name}=postgres://user:pass@localhost:5432/applypilot_dev`,
    );
  }
  return value;
}

/** Connection string for the application (dev/prod). */
export function databaseUrl(): string {
  return required('DATABASE_URL');
}

/**
 * Connection string for the isolated test database. Falling back to DATABASE_URL
 * is deliberately NOT allowed — tests must never run against the dev database.
 */
export function testDatabaseUrl(): string {
  return required('TEST_DATABASE_URL');
}
