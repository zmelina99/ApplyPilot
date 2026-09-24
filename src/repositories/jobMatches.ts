import { and, eq, desc, inArray } from 'drizzle-orm';
import type { Database, Exec } from '../db/client.js';
import { jobMatches, jobs } from '../db/schema/index.js';
import type { JobMatch } from '../db/schema/jobMatches.js';
import type { Job } from '../db/schema/jobs.js';
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
  evaluationDetails?: unknown;
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
  const { evaluationDetails, ...rest } = input;
  const [row] = await db
    .update(jobMatches)
    .set({
      ...rest,
      ...(evaluationDetails !== undefined
        ? { evaluationDetails: evaluationDetails as JobMatch['evaluationDetails'] }
        : {}),
      evaluatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobMatches.id, matchId))
    .returning();
  if (!row) throw new NotFoundError('JobMatch', matchId);
  return row;
}

export interface MatchWithJob {
  match: JobMatch;
  job: Job;
}

/** Matches for a user in the given match statuses, joined with their job. */
export async function listMatchesWithJobs(
  exec: Exec,
  userId: string,
  statuses: JobMatch['status'][],
  limit = 300,
): Promise<MatchWithJob[]> {
  if (statuses.length === 0) return [];
  const rows = await exec
    .select({ match: jobMatches, job: jobs })
    .from(jobMatches)
    .innerJoin(jobs, eq(jobMatches.jobId, jobs.id))
    .where(and(eq(jobMatches.userId, userId), inArray(jobMatches.status, statuses)))
    .limit(limit);
  return rows;
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
