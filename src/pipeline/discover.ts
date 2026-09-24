import type { Database } from '../db/client.js';
import { loadSearchConfig, type SearchConfig } from '../config/searchConfig.js';
import { enabledAdapters } from '../sources/index.js';
import type { JobSourceAdapter, NormalizedJobCandidate } from '../sources/types.js';
import { usersRepo, jobsRepo, jobSourcesRepo, matchesRepo, reviewsRepo } from '../repositories/index.js';
import { evaluateEligibility } from '../eligibility/engine.js';
import type { EligibilityResult, ReviewCode } from '../eligibility/types.js';
import type { NewReviewItem } from '../db/schema/reviewItems.js';
import type { JobMatch } from '../db/schema/jobMatches.js';

const EVALUATION_VERSION = 'elig-2b-1';

export interface DiscoverStats {
  perSource: Record<string, number>;
  sourceErrors: { source: string; error: string }[];
  discovered: number;
  normalized: number;
  newJobs: number;
  existingJobs: number;
  duplicates: number;
  eligible: number;
  rejected: number;
  needsReview: number;
  reviewItemsCreated: number;
  rejectionReasons: Record<string, number>;
  reviewReasons: Record<string, number>;
}

function reviewTypeFor(code: ReviewCode): NewReviewItem['reviewType'] {
  switch (code) {
    case 'SALARY_COMPARISON_AMBIGUOUS':
      return 'SALARY_QUESTION';
    case 'ROLE_SCOPE_AMBIGUOUS':
      return 'OTHER';
    default:
      return 'AMBIGUOUS_ELIGIBILITY';
  }
}

function mapToMatch(result: EligibilityResult): {
  status: JobMatch['status'];
  eligibilityStatus: JobMatch['eligibilityStatus'];
} {
  switch (result.status) {
    case 'ELIGIBLE':
      return { status: 'QUALIFIED', eligibilityStatus: 'ELIGIBLE' };
    case 'INELIGIBLE':
      return { status: 'REJECTED', eligibilityStatus: 'INELIGIBLE' };
    case 'NEEDS_REVIEW':
      return { status: 'PENDING', eligibilityStatus: 'AMBIGUOUS' };
  }
}

/**
 * End-to-end deterministic discovery:
 *   adapters → normalize → dedup/store job+source → deterministic eligibility →
 *   create/update job match → review items for ambiguity.
 * Idempotent and LLM-free. Applications are NOT created here (Phase 2B stops at the
 * shortlist).
 */
export async function runDiscovery(
  db: Database,
  opts: { limit?: number; adapters?: JobSourceAdapter[]; config?: SearchConfig } = {},
): Promise<DiscoverStats> {
  const cfg = opts.config ?? loadSearchConfig();
  const adapters = opts.adapters ?? enabledAdapters();
  const now = new Date();

  const user =
    (await usersRepo.getFirstUser(db)) ??
    (await usersRepo.createUser(db, { displayName: 'Local User' }));

  const stats: DiscoverStats = {
    perSource: {},
    sourceErrors: [],
    discovered: 0,
    normalized: 0,
    newJobs: 0,
    existingJobs: 0,
    duplicates: 0,
    eligible: 0,
    rejected: 0,
    needsReview: 0,
    reviewItemsCreated: 0,
    rejectionReasons: {},
    reviewReasons: {},
  };

  // 1) Fetch + normalize from each source (one failing source never aborts the run).
  const candidates: NormalizedJobCandidate[] = [];
  for (const adapter of adapters) {
    try {
      const found = await adapter.discover({ limit: opts.limit });
      stats.perSource[adapter.name] = found.length;
      candidates.push(...found);
    } catch (err) {
      stats.perSource[adapter.name] = 0;
      stats.sourceErrors.push({
        source: adapter.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  stats.discovered = candidates.length;

  // 2) Store jobs + sources deterministically (dedup by canonical URL / source id).
  const seenThisRun = new Set<string>();
  for (const c of candidates) {
    const existing = await jobsRepo.getJobByCanonicalUrl(db, c.canonicalUrl);
    const job = await jobsRepo.upsertJob(db, {
      canonicalUrl: c.canonicalUrl,
      companyName: c.companyName,
      title: c.title,
      locationText: c.locationText,
      remoteType: c.remoteType,
      employmentType: c.employmentType,
      description: c.description,
      salaryMin: c.salaryMin,
      salaryMax: c.salaryMax,
      salaryCurrency: c.salaryCurrency,
      salaryPeriod: c.salaryPeriod,
      datePosted: c.datePosted,
    });
    await jobSourcesRepo.attachSource(db, {
      jobId: job.id,
      sourceName: c.sourceName,
      sourceUrl: c.sourceUrl,
      sourceJobId: c.sourceJobId,
      rawPayload: c.rawPayload,
    });
    stats.normalized += 1;

    if (seenThisRun.has(job.id)) {
      stats.duplicates += 1; // same posting via another source/entry this run
    } else {
      seenThisRun.add(job.id);
      if (existing) stats.existingJobs += 1;
      else stats.newJobs += 1;
    }
  }

  // 3) Deterministic eligibility per unique job, for the local user.
  for (const jobId of seenThisRun) {
    const job = await jobsRepo.getJob(db, jobId);
    if (!job) continue;
    const result = evaluateEligibility(job, cfg, now);
    const mapped = mapToMatch(result);

    const match = await matchesRepo.createMatch(db, user.id, job.id);
    await matchesRepo.updateEvaluation(db, match.id, {
      status: mapped.status,
      eligibilityStatus: mapped.eligibilityStatus,
      eligibilityReason: result.summary,
      evaluationDetails: {
        version: EVALUATION_VERSION,
        priority: result.priority,
        reasons: result.reasons,
      },
      evaluationVersion: EVALUATION_VERSION,
    });

    if (result.status === 'ELIGIBLE') stats.eligible += 1;
    else if (result.status === 'INELIGIBLE') {
      stats.rejected += 1;
      for (const r of result.reasons.filter((x) => x.kind === 'hard')) {
        stats.rejectionReasons[r.code] = (stats.rejectionReasons[r.code] ?? 0) + 1;
      }
    } else {
      stats.needsReview += 1;
      const reviewReasons = result.reasons.filter((x) => x.kind === 'review');
      for (const r of reviewReasons) {
        stats.reviewReasons[r.code] = (stats.reviewReasons[r.code] ?? 0) + 1;
      }
      const primary = reviewReasons[0];
      if (primary) {
        const { created } = await reviewsRepo.createReviewIfAbsent(db, {
          userId: user.id,
          jobId: job.id,
          reviewType: reviewTypeFor(primary.code as ReviewCode),
          reason: `${result.summary}: ${primary.message}`,
        });
        if (created) stats.reviewItemsCreated += 1;
      }
    }
  }

  return stats;
}
