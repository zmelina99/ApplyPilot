import type { JobSourceAdapter, NormalizedJobCandidate, DiscoverOptions } from './types.js';
import { fetchJson } from './httpClient.js';
import { parseMaybeDate, mapEmploymentType, cleanText } from './shared.js';

export const REMOTIVE_SOURCE = 'remotive';

/** Shape of a Remotive job (fields we use). */
export interface RemotiveRawJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

/** Pure normalization — unit-testable without network. */
export function normalizeRemotive(job: RemotiveRawJob): NormalizedJobCandidate {
  return {
    sourceName: REMOTIVE_SOURCE,
    sourceJobId: String(job.id),
    sourceUrl: job.url,
    canonicalUrl: job.url,
    companyName: cleanText(job.company_name),
    title: cleanText(job.title),
    description: job.description ?? null,
    locationText: cleanText(job.candidate_required_location),
    // Remotive lists only remote roles.
    remoteType: 'REMOTE',
    employmentType: mapEmploymentType(job.job_type),
    // Remotive salary is free text (e.g. "$50k-70k"); we do NOT parse numbers
    // (that would be guessing). Kept in raw_payload only.
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    datePosted: parseMaybeDate(job.publication_date),
    rawPayload: {
      category: job.category,
      tags: job.tags,
      job_type: job.job_type,
      candidate_required_location: job.candidate_required_location,
      salary: job.salary,
    },
  };
}

export class RemotiveAdapter implements JobSourceAdapter {
  readonly name = REMOTIVE_SOURCE;

  async discover(options: DiscoverOptions = {}): Promise<NormalizedJobCandidate[]> {
    const limit = options.limit ?? 100;
    const url = `https://remotive.com/api/remote-jobs?category=software-dev&limit=${limit}`;
    const data = await fetchJson<{ jobs?: RemotiveRawJob[] }>(url);
    return (data.jobs ?? []).map(normalizeRemotive);
  }
}
