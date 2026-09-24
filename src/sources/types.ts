import type { Job } from '../db/schema/jobs.js';

/**
 * A normalized job posting produced by a source adapter, before it is stored. Fields
 * mirror the `jobs` schema. Missing data MUST be null/undefined — never invented.
 */
export interface NormalizedJobCandidate {
  sourceName: string;
  sourceJobId: string | null;
  sourceUrl: string;
  /** Canonical application/job URL used as the global dedup identity. */
  canonicalUrl: string;
  companyName: string | null;
  title: string | null;
  description: string | null;
  locationText: string | null;
  remoteType: Job['remoteType'];
  employmentType: Job['employmentType'];
  salaryMin: string | null;
  salaryMax: string | null;
  salaryCurrency: string | null;
  salaryPeriod: Job['salaryPeriod'];
  datePosted: Date | null;
  /** Useful source-specific fields kept for audit (stored in job_sources.raw_payload). */
  rawPayload: unknown;
}

export interface DiscoverOptions {
  /** Soft cap on candidates to fetch per source (adapters may fetch fewer). */
  limit?: number;
}

/**
 * The source boundary. Each adapter knows how to talk to ONE external source and
 * return normalized candidates. The rest of ApplyPilot never depends on a specific
 * job board — only on this interface.
 *
 * Adapters must use legitimate public data (APIs/feeds), set a clear User-Agent, and
 * must NOT bypass anti-bot systems, CAPTCHAs, or authentication.
 */
export interface JobSourceAdapter {
  readonly name: string;
  discover(options?: DiscoverOptions): Promise<NormalizedJobCandidate[]>;
}
