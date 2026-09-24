import type { JobSourceAdapter, NormalizedJobCandidate, DiscoverOptions } from './types.js';
import { fetchJson } from './httpClient.js';
import { parseMaybeDate, mapEmploymentTypes, cleanText } from './shared.js';

export const ARBEITNOW_SOURCE = 'arbeitnow';

/** Shape of an Arbeitnow job (fields we use). */
export interface ArbeitnowRawJob {
  slug: string;
  company_name: string;
  title: string;
  description?: string;
  remote?: boolean;
  url: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
}

export function normalizeArbeitnow(job: ArbeitnowRawJob): NormalizedJobCandidate {
  return {
    sourceName: ARBEITNOW_SOURCE,
    sourceJobId: job.slug,
    sourceUrl: job.url,
    canonicalUrl: job.url,
    companyName: cleanText(job.company_name),
    title: cleanText(job.title),
    description: job.description ?? null,
    locationText: cleanText(job.location),
    // Arbeitnow exposes a boolean remote flag; onsite/hybrid is not distinguished, so
    // non-remote is recorded as ONSITE (conservative) rather than invented as HYBRID.
    remoteType: job.remote ? 'REMOTE' : 'ONSITE',
    employmentType: mapEmploymentTypes(job.job_types),
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    datePosted: parseMaybeDate(job.created_at),
    rawPayload: {
      tags: job.tags,
      job_types: job.job_types,
      remote: job.remote,
    },
  };
}

export class ArbeitnowAdapter implements JobSourceAdapter {
  readonly name = ARBEITNOW_SOURCE;

  async discover(options: DiscoverOptions = {}): Promise<NormalizedJobCandidate[]> {
    const limit = options.limit ?? 100;
    // Single page (up to ~100). We intentionally do not deep-paginate the whole board.
    const url = 'https://www.arbeitnow.com/api/job-board-api';
    const data = await fetchJson<{ data?: ArbeitnowRawJob[] }>(url);
    return (data.data ?? []).slice(0, limit).map(normalizeArbeitnow);
  }
}
