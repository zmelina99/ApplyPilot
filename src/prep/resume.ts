import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Detect a default resume in resumes/. Phase 2D only associates it with a prepared
 * application — it never uploads it to an employer. Content is never modified.
 */
export function detectDefaultResume(dir = path.resolve('resumes')): { available: boolean; name: string | null } {
  try {
    if (!existsSync(dir)) return { available: false, name: null };
    const files = readdirSync(dir).filter((f) => /\.(pdf|docx?|rtf)$/i.test(f));
    return files.length ? { available: true, name: files[0]! } : { available: false, name: null };
  } catch {
    return { available: false, name: null };
  }
}
