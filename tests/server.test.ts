import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import { runDiscovery } from '../src/pipeline/discover.js';
import { planAnalysis, runAnalysis } from '../src/pipeline/analyze.js';
import { buildCandidateAnalysis } from '../src/analysis/candidateAnalysis.js';
import { loadCandidateFacts } from '../src/config/candidateFacts.js';
import { loadSearchConfig } from '../src/config/searchConfig.js';
import { FakeFitAnalyzer } from '../src/analysis/fakeAnalyzer.js';
import {
  getDashboard, listJobs, getJobDetail, listApplications, getApplicationDetail,
  listBlockingReviews, resolveReview,
} from '../src/server/queries.js';
import { usersRepo, jobsRepo, matchesRepo, applicationsRepo, reviewsRepo } from '../src/repositories/index.js';
import type { NormalizedJobCandidate, JobSourceAdapter } from '../src/sources/types.js';

const cfg = loadSearchConfig();
const candidate = buildCandidateAnalysis(loadCandidateFacts());
const recent = () => new Date(Date.now() - 12 * 60 * 60 * 1000);

function cand(p: Partial<NormalizedJobCandidate>): NormalizedJobCandidate {
  return {
    sourceName: 'jobicy', sourceJobId: null, sourceUrl: 'https://x/1', canonicalUrl: 'https://x/1',
    companyName: 'Co', title: 'Frontend Engineer', description: 'React + TypeScript, frontend architecture.',
    locationText: 'Europe', remoteType: 'REMOTE', employmentType: 'PERMANENT',
    salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null,
    datePosted: recent(), rawPayload: {}, ...p,
  };
}
const adapter = (c: NormalizedJobCandidate[]): JobSourceAdapter => ({ name: 'jobicy', discover: async () => c });

const ELIG = cand({ title: 'Senior Frontend Engineer', canonicalUrl: 'https://x/e', sourceUrl: 'https://x/e', locationText: 'Remote — Europe' });
const AMB = cand({ title: 'React Engineer', canonicalUrl: 'https://x/a', sourceUrl: 'https://x/a', locationText: 'United States', description: 'Remote React role.' });
const REJ = cand({ title: 'Backend Engineer', canonicalUrl: 'https://x/r', sourceUrl: 'https://x/r', description: 'Go and Postgres services.' });

describe('web data-access layer', () => {
  let handle: DbHandle;
  beforeAll(async () => { handle = await openTestDb(); });
  afterAll(async () => { await handle.close(); });
  beforeEach(async () => {
    await resetDb(handle.db);
    await runDiscovery(handle.db, { adapters: [adapter([ELIG, AMB, REJ])], config: cfg });
  });

  it('dashboard aggregates match the underlying data', async () => {
    const d = await getDashboard(handle.db);
    expect(d.counts.jobsDiscovered).toBe(3);
    expect(d.counts.eligible).toBe(1);
    expect(d.counts.needsReview).toBe(1);
    expect(d.counts.rejected).toBe(1);
    expect(d.counts.fitAnalyzed).toBe(0);
    expect(d.counts.awaitingAnalysis).toBe(2); // eligible + ambiguous, not yet analyzed
    expect(d.bestMatches).toHaveLength(0); // no fake scores when nothing analyzed
  });

  it('jobs list hides rejects by default, supports filtering and search', async () => {
    const def = await listJobs(handle.db, {});
    expect(def.items.every((j) => j.eligibilityStatus !== 'INELIGIBLE')).toBe(true);
    expect(def.items).toHaveLength(2);

    const rejected = await listJobs(handle.db, { eligibility: 'INELIGIBLE' });
    expect(rejected.items).toHaveLength(1);
    expect(rejected.items[0]!.title).toBe('Backend Engineer');

    const searched = await listJobs(handle.db, { q: 'senior' });
    expect(searched.items.map((j) => j.title)).toContain('Senior Frontend Engineer');

    const notAnalyzed = await listJobs(handle.db, { fit: 'NOT_ANALYZED' });
    expect(notAnalyzed.items.every((j) => j.fitScore === null)).toBe(true);
  });

  it('job detail separates deterministic eligibility from fit, no fake score when unanalyzed', async () => {
    const jobs = await listJobs(handle.db, { eligibility: 'ELIGIBLE' });
    const detail = await getJobDetail(handle.db, jobs.items[0]!.id);
    expect(detail).toBeTruthy();
    expect(detail!.eligibility.status).toBe('ELIGIBLE');
    expect(detail!.fit).toBeNull(); // not analyzed → no invented score
    expect(detail!.descriptionText).not.toMatch(/</); // stripped, not raw HTML
  });

  it('surfaces real fit analysis once analyzed (fake analyzer)', async () => {
    const plan = await planAnalysis(handle.db, candidate);
    await runAnalysis(handle.db, candidate, new FakeFitAnalyzer(), plan);
    const d = await getDashboard(handle.db);
    expect(d.counts.fitAnalyzed).toBe(2);
    expect(d.bestMatches.length).toBeGreaterThan(0);
    expect(d.bestMatches[0]!.fitScore).toBeGreaterThan(0);

    const jobs = await listJobs(handle.db, { eligibility: 'ELIGIBLE' });
    const detail = await getJobDetail(handle.db, jobs.items[0]!.id);
    expect(detail!.fit).not.toBeNull();
    expect(detail!.fit!.components.role_alignment.score).toBeGreaterThan(0);
  });

  it('applications: empty by default, then reflects a created application and ordered events', async () => {
    expect(await listApplications(handle.db)).toHaveLength(0);

    const user = await usersRepo.getFirstUser(handle.db);
    const job = (await jobsRepo.listJobs(handle.db))[0]!;
    const app = await applicationsRepo.createApplication(handle.db, user!.id, job.id);
    await applicationsRepo.transitionStatus(handle.db, app.id, 'APPLYING');
    await applicationsRepo.transitionStatus(handle.db, app.id, 'READY_FOR_APPROVAL');

    const apps = await listApplications(handle.db);
    expect(apps).toHaveLength(1);
    expect(apps[0]!.status).toBe('READY_FOR_APPROVAL');
    expect(apps[0]!.needsAttention).toBe(true);

    const detail = await getApplicationDetail(handle.db, app.id);
    const types = detail!.events.map((e) => e.eventType);
    expect(types[0]).toBe('APPLICATION_CREATED');
    expect(types).toEqual(['APPLICATION_CREATED', 'STATUS_CHANGED', 'STATUS_CHANGED']);
  });

  it('review queue shows blocking reviews only; non-blocking uncertainty is excluded', async () => {
    const user = await usersRepo.getFirstUser(handle.db);
    const job = (await jobsRepo.listJobs(handle.db))[0]!;
    await reviewsRepo.createReviewItem(handle.db, { userId: user!.id, jobId: job.id, reviewType: 'SWISS_APPLICATION', reason: 'Swiss' });
    await reviewsRepo.createReviewItem(handle.db, { userId: user!.id, jobId: job.id, reviewType: 'AMBIGUOUS_ELIGIBILITY', reason: 'geo' });

    const blocking = await listBlockingReviews(handle.db);
    expect(blocking).toHaveLength(1);
    expect(blocking[0]!.reviewType).toBe('SWISS_APPLICATION');
  });

  it('resolving a review uses existing domain behavior and persists the note', async () => {
    const user = await usersRepo.getFirstUser(handle.db);
    const item = await reviewsRepo.createReviewItem(handle.db, { userId: user!.id, reviewType: 'SWISS_APPLICATION' });
    await resolveReview(handle.db, item.id, 'RESOLVED', 'approved by me');
    const after = await reviewsRepo.getReviewItem(handle.db, item.id);
    expect(after!.status).toBe('RESOLVED');
    expect((after!.payload as { humanNote?: string }).humanNote).toBe('approved by me');
    expect(await listBlockingReviews(handle.db)).toHaveLength(0);
  });
});
