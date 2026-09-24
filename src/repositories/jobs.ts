import { eq, desc, sql } from 'drizzle-orm';
import type { Database, Exec } from '../db/client.js';
import { jobs } from '../db/schema/index.js';
import type { Job } from '../db/schema/jobs.js';
import { normalizeCanonicalUrl } from '../domain/canonicalUrl.js';

export interface UpsertJobInput {
  canonicalUrl: string;
  companyName?: string | null;
  title?: string | null;
  locationText?: string | null;
  remoteType?: Job['remoteType'];
  employmentType?: Job['employmentType'];
  description?: string | null;
  salaryMin?: string | null;
  salaryMax?: string | null;
  salaryCurrency?: string | null;
  salaryPeriod?: Job['salaryPeriod'];
  datePosted?: Date | null;
  postingStatus?: Job['postingStatus'];
}

/**
 * Create a job, or update it if one with the same normalized canonical URL already
 * exists (jobs are global and deduped by canonical URL). On conflict we refresh
 * `last_seen_at` and any provided fields, but never overwrite a known value with
 * NULL — missing source data must not erase existing data.
 */
export async function upsertJob(db: Database, input: UpsertJobInput): Promise<Job> {
  const canonicalUrl = normalizeCanonicalUrl(input.canonicalUrl);
  const now = new Date();

  const [row] = await db
    .insert(jobs)
    .values({
      canonicalUrl,
      companyName: input.companyName ?? null,
      title: input.title ?? null,
      locationText: input.locationText ?? null,
      remoteType: input.remoteType ?? 'UNKNOWN',
      employmentType: input.employmentType ?? null,
      description: input.description ?? null,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      salaryCurrency: input.salaryCurrency ?? null,
      salaryPeriod: input.salaryPeriod ?? null,
      datePosted: input.datePosted ?? null,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: jobs.canonicalUrl,
      set: {
        // COALESCE(new, existing): only fill fields, never null them out.
        companyName: sql`coalesce(excluded.company_name, ${jobs.companyName})`,
        title: sql`coalesce(excluded.title, ${jobs.title})`,
        locationText: sql`coalesce(excluded.location_text, ${jobs.locationText})`,
        description: sql`coalesce(excluded.description, ${jobs.description})`,
        salaryMin: sql`coalesce(excluded.salary_min, ${jobs.salaryMin})`,
        salaryMax: sql`coalesce(excluded.salary_max, ${jobs.salaryMax})`,
        salaryCurrency: sql`coalesce(excluded.salary_currency, ${jobs.salaryCurrency})`,
        datePosted: sql`coalesce(excluded.date_posted, ${jobs.datePosted})`,
        lastSeenAt: now,
        updatedAt: now,
      },
    })
    .returning();

  if (!row) throw new Error('Failed to upsert job');
  return row;
}

export async function getJob(exec: Exec, id: string): Promise<Job | null> {
  const [row] = await exec.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return row ?? null;
}

export async function getJobByCanonicalUrl(
  exec: Exec,
  url: string,
): Promise<Job | null> {
  const canonicalUrl = normalizeCanonicalUrl(url);
  const [row] = await exec
    .select()
    .from(jobs)
    .where(eq(jobs.canonicalUrl, canonicalUrl))
    .limit(1);
  return row ?? null;
}

export async function listJobs(exec: Exec, limit = 100): Promise<Job[]> {
  return exec.select().from(jobs).orderBy(desc(jobs.firstDiscoveredAt)).limit(limit);
}
