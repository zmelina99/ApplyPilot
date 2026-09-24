import { and, eq, desc, inArray, isNotNull, gte } from 'drizzle-orm';
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

/** Matches for a user by ELIGIBILITY status (ELIGIBLE / AMBIGUOUS / …), with job. */
export async function listMatchesWithJobsByEligibility(
  exec: Exec,
  userId: string,
  eligibilityStatuses: JobMatch['eligibilityStatus'][],
  limit = 1000,
): Promise<MatchWithJob[]> {
  if (eligibilityStatuses.length === 0) return [];
  return exec
    .select({ match: jobMatches, job: jobs })
    .from(jobMatches)
    .innerJoin(jobs, eq(jobMatches.jobId, jobs.id))
    .where(
      and(
        eq(jobMatches.userId, userId),
        inArray(jobMatches.eligibilityStatus, eligibilityStatuses),
      ),
    )
    .limit(limit);
}

/** Analyzed matches (fit_score present) for a user, with job. Ranking done by caller. */
export async function listAnalyzedWithJobs(
  exec: Exec,
  userId: string,
  minFit = 0,
  limit = 1000,
): Promise<MatchWithJob[]> {
  return exec
    .select({ match: jobMatches, job: jobs })
    .from(jobMatches)
    .innerJoin(jobs, eq(jobMatches.jobId, jobs.id))
    .where(
      and(
        eq(jobMatches.userId, userId),
        isNotNull(jobMatches.fitScore),
        gte(jobMatches.fitScore, minFit),
      ),
    )
    .limit(limit);
}

export interface SaveFitInput {
  fitScore: number;
  fitStatus: JobMatch['fitStatus'];
  fitReason: string;
  fitAnalysis: unknown;
  fitAnalysisHash: string;
  fitModel: string;
  fitPromptVersion: string;
}

/** Persist a completed fit analysis onto a match. */
export async function saveFitAnalysis(
  db: Database,
  matchId: string,
  input: SaveFitInput,
): Promise<JobMatch> {
  const [row] = await db
    .update(jobMatches)
    .set({
      fitScore: input.fitScore,
      fitStatus: input.fitStatus,
      fitReason: input.fitReason,
      fitAnalysis: input.fitAnalysis as JobMatch['fitAnalysis'],
      fitAnalysisHash: input.fitAnalysisHash,
      fitModel: input.fitModel,
      fitPromptVersion: input.fitPromptVersion,
      fitAnalyzedAt: new Date(),
      updatedAt: new Date(),
    })
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
