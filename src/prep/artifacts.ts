import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** Stored when the candidate will attach this file manually at apply time. */
export const MANUAL_AT_APPLY_TIME = '[MANUAL_AT_APPLY_TIME]';

const LOCAL_FILE_RE = /^\[LOCAL_FILE:(.+)\]$/;

/** Encode an approved local filename (under resumes/) as an answer value. */
export function encodeLocalFile(filename: string): string {
  return `[LOCAL_FILE:${filename}]`;
}

export function isManualArtifact(value: string | null | undefined): boolean {
  return value === MANUAL_AT_APPLY_TIME;
}

export function parseLocalFile(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(LOCAL_FILE_RE);
  return m?.[1] ?? null;
}

/** List attachable files in resumes/ (gitignored personal artifacts). */
export function listApprovedLocalFiles(dir = path.resolve('resumes')): string[] {
  try {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => /\.(pdf|docx?|rtf|zip|png|jpe?g)$/i.test(f))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/** True when filename exists under resumes/ — never invent paths. */
export function validateLocalFile(filename: string, dir = path.resolve('resumes')): boolean {
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) return false;
  return existsSync(path.join(dir, filename));
}
