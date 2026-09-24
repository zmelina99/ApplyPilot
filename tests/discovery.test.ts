import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import { runDiscovery } from '../src/pipeline/discover.js';
import { loadSearchConfig } from '../src/config/searchConfig.js';
import type { JobSourceAdapter, NormalizedJobCandidate } from '../src/sources/types.js';
import { usersRepo, jobsRepo, jobSourcesRepo, matchesRepo, reviewsRepo } from '../src/repositories/index.js';

const cfg = loadSearchConfig();
const recent = () => new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

function candidate(p: Partial<NormalizedJobCandidate>): NormalizedJobCandidate {
  return {
    sourceName: 'fake',
    sourceJobId: 'id-1',
    sourceUrl: 'https://fake.example/j/1',
    canonicalUrl: 'https://fake.example/j/1',
    companyName: 'Fake Co',
    title: 'Frontend Engineer',
    description: 'React + TypeScript',
    locationText: 'Europe',
    remoteType: 'REMOTE',
    employmentType: 'PERMANENT',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    datePosted: recent(),
    rawPayload: { demo: true },
    ...p,
  };
}

function fakeAdapter(name: string, cands: NormalizedJobCandidate[]): JobSourceAdapter {
  return { name, discover: async () => cands };
}

const ELIGIBLE = candidate({
  sourceJobId: 'A',
  sourceUrl: 'https://fake.example/j/A',
  canonicalUrl: 'https://fake.example/j/A',
  locationText: 'Europe',
});
const US_RESIDENCY = candidate({
  sourceJobId: 'B',
  sourceUrl: 'https://fake.example/j/B',
  canonicalUrl: 'https://fake.example/j/B',
  locationText: 'United States',
  description: 'You must reside in the US and have US work authorization.',
});
const AMBIGUOUS = candidate({
  sourceJobId: 'C',
  sourceUrl: 'https://fake.example/j/C',
  canonicalUrl: 'https://fake.example/j/C',
  locationText: 'United States',
  description: 'Remote frontend role.',
});

describe('discovery pipeline (fake adapter, no network)', () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = await openTestDb();
  });
  afterAll(async () => {
    await handle.close();
  });
  beforeEach(async () => {
    await resetDb(handle.db);
  });

  it('ingests, classifies, and is idempotent across runs', async () => {
    const adapters = [fakeAdapter('fake', [ELIGIBLE, US_RESIDENCY, AMBIGUOUS])];

    const s1 = await runDiscovery(handle.db, { adapters, config: cfg });
    expect(s1.discovered).toBe(3);
    expect(s1.newJobs).toBe(3);
    expect(s1.existingJobs).toBe(0);
    expect(s1.eligible).toBe(1);
    expect(s1.rejected).toBe(1);
    expect(s1.needsReview).toBe(1);

    const user = await usersRepo.getFirstUser(handle.db);
    expect(await jobsRepo.listJobs(handle.db)).toHaveLength(3);
    expect(await matchesRepo.listMatchesForUser(handle.db, user!.id)).toHaveLength(3);
    // Phase 2C: discovery no longer creates blocking review items for non-blocking
    // ambiguity — the ambiguity stays on the match and feeds fit analysis.
    expect(await reviewsRepo.listUnresolvedReviews(handle.db, user!.id)).toHaveLength(0);

    // Second run: nothing new, still no review items, no duplicate jobs/matches.
    const s2 = await runDiscovery(handle.db, { adapters, config: cfg });
    expect(s2.newJobs).toBe(0);
    expect(s2.existingJobs).toBe(3);
    expect(await jobsRepo.listJobs(handle.db)).toHaveLength(3);
    expect(await reviewsRepo.listUnresolvedReviews(handle.db, user!.id)).toHaveLength(0);
  });

  it('does not duplicate the same source job seen twice in one run', async () => {
    const adapters = [fakeAdapter('fake', [ELIGIBLE, ELIGIBLE])];
    const s = await runDiscovery(handle.db, { adapters, config: cfg });
    expect(s.discovered).toBe(2);
    expect(s.newJobs).toBe(1);
    expect(s.duplicates).toBe(1);
    expect(await jobsRepo.listJobs(handle.db)).toHaveLength(1);
  });

  it('dedupes one job discovered via two sources into one job with two sources', async () => {
    const fromX = candidate({
      sourceName: 'x',
      sourceJobId: 'x1',
      sourceUrl: 'https://x.example/1',
      canonicalUrl: 'https://shared.example/job/1',
    });
    const fromY = candidate({
      sourceName: 'y',
      sourceJobId: 'y1',
      sourceUrl: 'https://y.example/1',
      canonicalUrl: 'https://shared.example/job/1',
    });
    const s = await runDiscovery(handle.db, {
      adapters: [fakeAdapter('x', [fromX]), fakeAdapter('y', [fromY])],
      config: cfg,
    });
    expect(s.newJobs).toBe(1);
    expect(s.duplicates).toBe(1);
    const jobs = await jobsRepo.listJobs(handle.db);
    expect(jobs).toHaveLength(1);
    const sources = await jobSourcesRepo.listSourcesForJob(handle.db, jobs[0]!.id);
    expect(sources).toHaveLength(2);
  });

  it('survives one failing source and still processes the others', async () => {
    const bad: JobSourceAdapter = {
      name: 'broken',
      discover: async () => {
        throw new Error('network down');
      },
    };
    const s = await runDiscovery(handle.db, {
      adapters: [bad, fakeAdapter('fake', [ELIGIBLE])],
      config: cfg,
    });
    expect(s.sourceErrors).toHaveLength(1);
    expect(s.eligible).toBe(1);
  });
});
