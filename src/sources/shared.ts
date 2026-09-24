import type { Job } from '../db/schema/jobs.js';

/**
 * Parse a date string into a Date, or null if absent/unparseable. When the string
 * carries no timezone (e.g. "2026-09-21T12:55:11"), it is treated as UTC rather than
 * local, so freshness math is stable regardless of the machine's timezone.
 */
export function parseMaybeDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    // Unix seconds (10 digits) vs milliseconds.
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  let s = value.trim();
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s) && !hasTz) s += 'Z';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Map a variety of source "job type" strings to the employment_type enum, or null. */
export function mapEmploymentType(
  raw: string | null | undefined,
): Job['employmentType'] {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(/[\s_-]+/g, '');
  if (s.includes('fulltime') || s === 'permanent') return 'PERMANENT';
  if (s.includes('fixedterm') || s.includes('temporary')) return 'FIXED_TERM';
  if (s.includes('contract')) return 'CONTRACT';
  if (s.includes('freelance')) return 'FREELANCE';
  return null; // part-time, internship, unknown → leave null (never invent)
}

/** First non-empty employment type from a list of source job-type strings. */
export function mapEmploymentTypes(
  raws: (string | null | undefined)[] | null | undefined,
): Job['employmentType'] {
  if (!raws) return null;
  for (const r of raws) {
    const mapped = mapEmploymentType(r);
    if (mapped) return mapped;
  }
  return null;
}

/** Collapse whitespace; return null for empty. Never fabricates content. */
export function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const s = value.replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
}
