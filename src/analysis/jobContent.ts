import { createHash } from 'node:crypto';
import type { Job } from '../db/schema/jobs.js';
import type { JobAnalysisInput } from './types.js';

const MAX_DESCRIPTION_CHARS = 6000;

/**
 * Build the compact, cleaned job object sent to the analyzer. Strips HTML and caps
 * length so prompts stay small. Only relevant fields are included.
 */
export function buildJobAnalysisInput(job: Job): JobAnalysisInput {
  const salary =
    job.salaryMin || job.salaryMax
      ? `${job.salaryMin ?? '?'}-${job.salaryMax ?? '?'} ${job.salaryCurrency ?? ''}/${job.salaryPeriod ?? ''}`.trim()
      : null;
  return {
    title: job.title,
    company: job.companyName,
    location: job.locationText,
    remoteType: job.remoteType,
    employmentType: job.employmentType,
    salary,
    description: cleanDescription(job.description),
  };
}

function cleanDescription(html: string | null): string {
  // htmlToText already strips tags, decodes basic entities, collapses whitespace, and
  // lowercases. We keep original case for the model by re-stripping from the raw HTML.
  if (!html) return '';
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, MAX_DESCRIPTION_CHARS);
}

/**
 * Deterministic analysis cache key: profile version + prompt version + scoring
 * version + the relevant normalized job content. Two runs over unchanged inputs
 * produce the same hash → cache hit → no LLM call.
 */
export function analysisHash(params: {
  profileVersion: string;
  promptVersion: string;
  scoringVersion: string;
  job: JobAnalysisInput;
}): string {
  const canonical = JSON.stringify({
    p: params.profileVersion,
    pr: params.promptVersion,
    sc: params.scoringVersion,
    job: {
      t: params.job.title,
      c: params.job.company,
      l: params.job.location,
      r: params.job.remoteType,
      e: params.job.employmentType,
      s: params.job.salary,
      d: params.job.description,
    },
  });
  return createHash('sha256').update(canonical).digest('hex');
}
