import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * True when the module with `importMetaUrl` is the process entrypoint (was run
 * directly, e.g. `tsx src/db/migrate.ts`), rather than imported. Robust to relative
 * argv[1] paths (tsx passes the path as given on the command line).
 */
export function isEntrypoint(importMetaUrl: string): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  return path.resolve(invoked) === fileURLToPath(importMetaUrl);
}
