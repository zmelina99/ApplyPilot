#!/usr/bin/env bash
# One-time local database setup for ApplyPilot.
# Creates the `applypilot` role and the dev/test databases in a PostgreSQL that is
# already running on localhost:5432. Idempotent — safe to re-run.
#
# Prereqs: a running local PostgreSQL. On macOS with Homebrew:
#   brew services start postgresql@14
# Or via Docker:
#   docker compose up -d
set -euo pipefail

HOST="${PGHOST:-localhost}"
PORT="${PGPORT:-5432}"
ROLE="applypilot"
PASSWORD="applypilot"

# Find psql/createdb even when postgresql@14 is keg-only on Homebrew.
if ! command -v psql >/dev/null 2>&1; then
  export PATH="/opt/homebrew/opt/postgresql@14/bin:/usr/local/opt/postgresql@14/bin:$PATH"
fi

if ! pg_isready -h "$HOST" -p "$PORT" -q; then
  echo "ERROR: PostgreSQL is not accepting connections on $HOST:$PORT."
  echo "Start it first, e.g.:  brew services start postgresql@14   (or: docker compose up -d)"
  exit 1
fi

echo "Creating role '$ROLE' (if missing)…"
psql -h "$HOST" -p "$PORT" -d postgres -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='$ROLE') THEN
    CREATE ROLE $ROLE LOGIN PASSWORD '$PASSWORD' CREATEDB;
  END IF;
END \$\$;
SQL

for DB in applypilot_dev applypilot_test; do
  if psql -h "$HOST" -p "$PORT" -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1; then
    echo "Database '$DB' already exists."
  else
    echo "Creating database '$DB'…"
    createdb -h "$HOST" -p "$PORT" -O "$ROLE" "$DB"
  fi
done

echo "Done. Now run:  npm run db:migrate"
