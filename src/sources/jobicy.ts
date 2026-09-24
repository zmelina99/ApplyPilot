import type { JobSourceAdapter, NormalizedJobCandidate, DiscoverOptions } from './types.js';
import { fetchJson } from './httpClient.js';
import { parseMaybeDate, mapEmploymentTypes, cleanText } from './shared.js';

export const JOBICY_SOURCE = 'jobicy';

/** Shape of a Jobicy v2 job (fields we use). */
export interface JobicyRawJob {
  id: number;
  url: string;
  jobSlug?: string;
  jobTitle: string;
  companyName: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  annualSalaryMin?: string | number | null;
  annualSalaryMax?: string | number | null;
  salaryCurrency?: string | null;
}

export function normalizeJobicy(job: JobicyRawJob): NormalizedJobCandidate {
  const hasSalary =
    (job.annualSalaryMin != null && job.annualSalaryMin !== '' && Number(job.annualSalaryMin) > 0) ||
    (job.annualSalaryMax != null && job.annualSalaryMax !== '' && Number(job.annualSalaryMax) > 0);

  return {
    sourceName: JOBICY_SOURCE,
    sourceJobId: String(job.id),
    sourceUrl: job.url,
    canonicalUrl: job.url,
    companyName: cleanText(job.companyName),
    title: cleanText(job.jobTitle),
    description: job.jobDescription ?? job.jobExcerpt ?? null,
    // jobGeo is Jobicy's location signal (e.g. "Anywhere", "USA", country list).
    locationText: cleanText(job.jobGeo),
    remoteType: 'REMOTE',
    employmentType: mapEmploymentTypes(job.jobType),
    salaryMin: hasSalary && job.annualSalaryMin != null ? String(job.annualSalaryMin) : null,
    salaryMax: hasSalary && job.annualSalaryMax != null ? String(job.annualSalaryMax) : null,
    salaryCurrency: hasSalary ? (job.salaryCurrency ?? null) : null,
    salaryPeriod: hasSalary ? 'YEAR' : null,
    datePosted: parseMaybeDate(job.pubDate),
    rawPayload: {
      jobIndustry: job.jobIndustry,
      jobType: job.jobType,
      jobLevel: job.jobLevel,
      jobGeo: job.jobGeo,
    },
  };
}

export class JobicyAdapter implements JobSourceAdapter {
  readonly name = JOBICY_SOURCE;

  async discover(options: DiscoverOptions = {}): Promise<NormalizedJobCandidate[]> {
    const count = Math.min(options.limit ?? 100, 100);
    // tag=react focuses the feed on frontend-relevant roles.
    const url = `https://jobicy.com/api/v2/remote-jobs?count=${count}&tag=react`;
    const data = await fetchJson<{ jobs?: JobicyRawJob[] }>(url);
    return (data.jobs ?? []).map(normalizeJobicy);
  }
}
