import { and, eq, desc } from 'drizzle-orm';
import type { Database, Exec } from '../db/client.js';
import { jobMatches } from '../db/schema/index.js';
import type { JobMatch } from '../db/schema/jobMatches.js';
import { NotFoundError } from '../domain/errors.js';

/**
 * Get-or-create the single match row for (user, job). The DB unique constraint on
 * (user_id, job_id) guarantees at most one; onConflictDoNothing keeps this
 * idempotent and race-safe.
 */
export async function createMatch(
  db: Database,
  userId: string,
  jobId: string,
): Promise<JobMatch> {
  const inserted = await db
    .insert(jobMatches)
    .values({ userId, jobId })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];

  const existing = await getMatch(db, userId, jobId);
  if (!existing) throw new Error('Match conflict but existing row not found');
  return existing;
}

export async function getMatch(
  exec: Exec,
  userId: string,
  jobId: string,
): Promise<JobMatch | null> {
  const [row] = await exec
    .select()
    .from(jobMatches)
    .where(and(eq(jobMatches.userId, userId), eq(jobMatches.jobId, jobId)))
    .limit(1);
  return row ?? null;
}

export interface EvaluationInput {
  status?: JobMatch['status'];
  eligibilityStatus?: JobMatch['eligibilityStatus'];
  eligibilityReason?: string | null;
  fitStatus?: JobMatch['fitStatus'];
  fitScore?: number | null;
  fitReason?: string | null;
  evaluationVersion?: string | null;
}

/**
 * Record an evaluation result for an existing match. Stamps `evaluated_at`.
 * (Phase 2A stores results deterministically written by callers/seed — no LLM.)
 */
export async function updateEvaluation(
  db: Database,
  matchId: string,
  input: EvaluationInput,
): Promise<JobMatch> {
  const [row] = await db
    .update(jobMatches)
    .set({ ...input, evaluatedAt: new Date(), updatedAt: new Date() })
    .where(eq(jobMatches.id, matchId))
    .returning();
  if (!row) throw new NotFoundError('JobMatch', matchId);
  return row;
}

export async function listMatchesForUser(
  exec: Exec,
  userId: string,
  limit = 100,
): Promise<JobMatch[]> {
  return exec
    .select()
    .from(jobMatches)
    .where(eq(jobMatches.userId, userId))
    .orderBy(desc(jobMatches.createdAt))
    .limit(limit);
}
