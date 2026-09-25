import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadApplicationDefaults } from '../config/applicationDefaults.js';

export interface DefaultResume {
  available: boolean;
  /** Configured filename only (not a full path). */
  name: string | null;
  /** Absolute path when the approved file exists on disk. */
  path: string | null;
}

/**
 * Resolve the approved default resume from config + resumes/. Never invents a path:
 * `resume.defaultFile` must be set in application-defaults.json and the file must exist.
 * Phase 2D only associates it with a prepared application — it never uploads it.
 */
export function detectDefaultResume(
  dir = path.resolve('resumes'),
  configPath?: string,
): DefaultResume {
  const { defaultFile } = loadApplicationDefaults(configPath).resume;
  if (!defaultFile) return { available: false, name: null, path: null };
  const full = path.join(dir, defaultFile);
  if (!existsSync(full)) return { available: false, name: defaultFile, path: null };
  return { available: true, name: defaultFile, path: full };
}
