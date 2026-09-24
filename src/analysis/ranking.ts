import type { Confidence } from './types.js';

/** The signals used to rank the shortlist. Geography/salary are deliberately absent. */
export interface Rankable {
  fitScore: number | null;
  priority: boolean; // posted within the freshness priority window (<=72h)
  datePosted: Date | null;
  confidence: Confidence | null;
}

function confRank(c: Confidence | null): number {
  return c === 'HIGH' ? 2 : c === 'MEDIUM' ? 1 : 0;
}

/**
 * Rank primarily by semantic fit score, then freshness (priority, newest), then
 * confidence. Missing salary and famous companies have no effect — they are not
 * inputs. Sort is stable-enough via explicit tiebreakers.
 */
export function rankByFit<T>(items: T[], get: (t: T) => Rankable): T[] {
  return [...items].sort((a, b) => {
    const ra = get(a);
    const rb = get(b);
    return (
      (rb.fitScore ?? 0) - (ra.fitScore ?? 0) ||
      Number(rb.priority) - Number(ra.priority) ||
      (rb.datePosted?.getTime() ?? 0) - (ra.datePosted?.getTime() ?? 0) ||
      confRank(rb.confidence) - confRank(ra.confidence)
    );
  });
}
