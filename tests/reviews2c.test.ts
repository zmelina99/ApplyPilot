import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import { runDiscovery } from '../src/pipeline/discover.js';
import { planAnalysis, cleanupNonBlockingReviews } from '../src/pipeline/analyze.js';
import { buildCandidateAnalysis } from '../src/analysis/candidateAnalysis.js';
import { loadCandidateFacts } from '../src/config/candidateFacts.js';
import { loadSearchConfig } from '../src/config/searchConfig.js';
import { usersRepo, jobsRepo, reviewsRepo } from '../src/repositories/index.js';
import type { NormalizedJobCandidate, JobSourceAdapter } from '../src/sources/types.js';

const cfg = loadSearchConfig();
const candidate = buildCandidateAnalysis(loadCandidateFacts());

const AMBIG: NormalizedJobCandidate = {
  sourceName: 'fake', sourceJobId: null, sourceUrl: 'https://x/a', canonicalUrl: 'https://x/a',
  companyName: 'Co', title: 'Frontend Engineer', description: 'Remote React role.',
  locationText: 'United States', remoteType: 'REMOTE', employmentType: 'PERMANENT',
  salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null,
  datePosted: new Date(), rawPayload: {},
};
const adapter = (c: NormalizedJobCandidate[]): JobSourceAdapter => ({ name: 'fake', discover: async () => c });

describe('review handling (Phase 2C)', () => {
  let handle: DbHandle;
  beforeAll(async () => { handle = await openTestDb(); });
  afterAll(async () => { await handle.close(); });
  beforeEach(async () => { await resetDb(handle.db); });

  it('non-blocking geography ambiguity does not create a blocking review, yet proceeds to fit analysis', async () => {
    await runDiscovery(handle.db, { adapters: [adapter([AMBIG])], config: cfg });
    const user = await usersRepo.getFirstUser(handle.db);
    // No blocking review created…
    expect(await reviewsRepo.listUnresolvedReviews(handle.db, user!.id)).toHaveLength(0);
    // …but the ambiguous job is queued for fit analysis.
    const plan = await planAnalysis(handle.db, candidate);
    expect(plan.nonBlockingAmbiguous).toBe(1);
    expect(plan.wouldAnalyze).toBe(1);
  });

  it('persists a human resolution and does not recreate the review', async () => {
    const user = await usersRepo.createUser(handle.db);
    const job = await jobsRepo.upsertJob(handle.db, { canonicalUrl: 'https://x/j1' });
    const { item } = await reviewsRepo.createReviewIfAbsent(handle.db, {
      userId: user.id, jobId: job.id, reviewType: 'SWISS_APPLICATION', reason: 'Swiss', contentHash: 'h1',
    });
    await reviewsRepo.resolveReviewItem(handle.db, item.id, 'RESOLVED', 'looks fine');

    const again = await reviewsRepo.createReviewIfAbsent(handle.db, {
      userId: user.id, jobId: job.id, reviewType: 'SWISS_APPLICATION', reason: 'Swiss', contentHash: 'h1',
    });
    expect(again.created).toBe(false);
    expect(again.item.status).toBe('RESOLVED');
    const decided = await reviewsRepo.getReviewItem(handle.db, item.id);
    expect((decided!.payload as { humanNote?: string }).humanNote).toBe('looks fine');
  });

  it('re-surfaces a review when the job content materially changed after resolution', async () => {
    const user = await usersRepo.createUser(handle.db);
    const job = await jobsRepo.upsertJob(handle.db, { canonicalUrl: 'https://x/j2' });
    const { item } = await reviewsRepo.createReviewIfAbsent(handle.db, {
      userId: user.id, jobId: job.id, reviewType: 'SWISS_APPLICATION', contentHash: 'old',
    });
    await reviewsRepo.resolveReviewItem(handle.db, item.id, 'RESOLVED');
    const again = await reviewsRepo.createReviewIfAbsent(handle.db, {
      userId: user.id, jobId: job.id, reviewType: 'SWISS_APPLICATION', contentHash: 'new',
    });
    expect(again.created).toBe(true);
    expect(again.reason).toBe('content_changed');
  });

  it('cleanup dismisses open non-blocking review items', async () => {
    const user = await usersRepo.createUser(handle.db);
    const job = await jobsRepo.upsertJob(handle.db, { canonicalUrl: 'https://x/j3' });
    await reviewsRepo.createReviewItem(handle.db, {
      userId: user.id, jobId: job.id, reviewType: 'AMBIGUOUS_ELIGIBILITY', reason: 'geo',
    });
    expect(await reviewsRepo.listUnresolvedReviews(handle.db, user.id)).toHaveLength(1);
    const n = await cleanupNonBlockingReviews(handle.db);
    expect(n).toBe(1);
    expect(await reviewsRepo.listUnresolvedReviews(handle.db, user.id)).toHaveLength(0);
  });
});
