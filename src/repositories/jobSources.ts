import { and, eq } from 'drizzle-orm';
import type { Database, Exec } from '../db/client.js';
import { jobSources } from '../db/schema/index.js';
import type { JobSource } from '../db/schema/jobSources.js';

export interface AttachSourceInput {
  jobId: string;
  sourceName: string;
  sourceUrl: string;
  sourceJobId?: string | null;
  rawPayload?: unknown;
}

/**
 * Attach a discovery source to a job, idempotently. Duplicate ingestion from the
 * same source (same source_name + source_url, or same source_name + source_job_id)
 * is a no-op that returns the existing row — enforced by DB unique indexes, so it is
 * safe under concurrency and re-runs.
 */
export async function attachSource(
  db: Database,
  input: AttachSourceInput,
): Promise<JobSource> {
  const inserted = await db
    .insert(jobSources)
    .values({
      jobId: input.jobId,
      sourceName: input.sourceName,
      sourceUrl: input.sourceUrl,
      sourceJobId: input.sourceJobId ?? null,
      rawPayload: input.rawPayload ?? null,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted[0]) return inserted[0];

  // Conflict: return the existing row for this source identity.
  const [existing] = await db
    .select()
    .from(jobSources)
    .where(
      and(
        eq(jobSources.sourceName, input.sourceName),
        eq(jobSources.sourceUrl, input.sourceUrl),
      ),
    )
    .limit(1);
  if (!existing) throw new Error('Source conflict but existing row not found');
  return existing;
}

export async function listSourcesForJob(
  exec: Exec,
  jobId: string,
): Promise<JobSource[]> {
  return exec
    .select()
    .from(jobSources)
    .where(eq(jobSources.jobId, jobId))
    .orderBy(jobSources.discoveredAt);
}
