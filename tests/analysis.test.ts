import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import { runDiscovery } from '../src/pipeline/discover.js';
import { planAnalysis, runAnalysis } from '../src/pipeline/analyze.js';
import { loadCandidateFacts } from '../src/config/candidateFacts.js';
import { buildCandidateAnalysis } from '../src/analysis/candidateAnalysis.js';
import { loadSearchConfig } from '../src/config/searchConfig.js';
import { FakeFitAnalyzer } from '../src/analysis/fakeAnalyzer.js';
import { PROMPT_VERSION, SCORING_VERSION } from '../src/analysis/schema.js';
import type {
  AnalyzerResult, CandidateAnalysis, FitAnalyzer, JobAnalysisInput,
} from '../src/analysis/types.js';
import type { NormalizedJobCandidate, JobSourceAdapter } from '../src/sources/types.js';
import { usersRepo, matchesRepo } from '../src/repositories/index.js';
import { jobs } from '../src/db/schema/index.js';

const cfg = loadSearchConfig();
const candidate = buildCandidateAnalysis(loadCandidateFacts());
const recent = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

/** Counting analyzer records which jobs it was asked to analyze. */
class CountingAnalyzer implements FitAnalyzer {
  provider = 'fake';
  model = 'fake';
  promptVersion = PROMPT_VERSION;
  scoringVersion = SCORING_VERSION;
  seen: string[] = [];
  private inner = new FakeFitAnalyzer();
  async analyze(c: CandidateAnalysis, j: JobAnalysisInput): Promise<AnalyzerResult> {
    this.seen.push(j.title ?? '');
    return this.inner.analyze(c, j);
  }
}
class ThrowingAnalyzer implements FitAnalyzer {
  provider = 'fake'; model = 'fake'; promptVersion = PROMPT_VERSION; scoringVersion = SCORING_VERSION;
  async analyze(): Promise<AnalyzerResult> { throw new Error('malformed output'); }
}

function candidateJob(p: Partial<NormalizedJobCandidate>): NormalizedJobCandidate {
  return {
    sourceName: 'fake', sourceJobId: null, sourceUrl: 'https://x/1', canonicalUrl: 'https://x/1',
    companyName: 'Co', title: 'Frontend Engineer', description: 'React + TypeScript',
    locationText: 'Europe', remoteType: 'REMOTE', employmentType: 'PERMANENT',
    salaryMin: null, salaryMax: null, salaryCurrency: null, salaryPeriod: null,
    datePosted: recent(), rawPayload: {}, ...p,
  };
}
const adapter = (cands: NormalizedJobCandidate[]): JobSourceAdapter => ({ name: 'fake', discover: async () => cands });

const ELIGIBLE = candidateJob({ title: 'Frontend Engineer EU', canonicalUrl: 'https://x/elig', sourceUrl: 'https://x/elig', locationText: 'Europe' });
const REJECTED = candidateJob({ title: 'Frontend Engineer USonly', canonicalUrl: 'https://x/rej', sourceUrl: 'https://x/rej', locationText: 'United States', description: 'You must reside in the US and have US work authorization.' });
const AMBIGUOUS = candidateJob({ title: 'Frontend Engineer USmaybe', canonicalUrl: 'https://x/amb', sourceUrl: 'https://x/amb', locationText: 'United States', description: 'Remote React frontend role.' });

describe('fit analysis pipeline', () => {
  let handle: DbHandle;
  beforeAll(async () => { handle = await openTestDb(); });
  afterAll(async () => { await handle.close(); });
  beforeEach(async () => {
    await resetDb(handle.db);
    await runDiscovery(handle.db, { adapters: [adapter([ELIGIBLE, REJECTED, AMBIGUOUS])], config: cfg });
  });

  it('analyzes eligible + non-blocking-ambiguous, never deterministic rejects', async () => {
    const plan = await planAnalysis(handle.db, candidate);
    expect(plan.eligible).toBe(1);
    expect(plan.nonBlockingAmbiguous).toBe(1);
    expect(plan.deterministicRejectsSkipped).toBe(1);
    expect(plan.wouldAnalyze).toBe(2);

    const counter = new CountingAnalyzer();
    const stats = await runAnalysis(handle.db, candidate, counter, plan);
    expect(stats.llmCalls).toBe(2);
    expect(stats.analyzed).toBe(2);
    // The rejected job was never sent to the analyzer.
    expect(counter.seen).toContain('Frontend Engineer EU');
    expect(counter.seen).toContain('Frontend Engineer USmaybe');
    expect(counter.seen).not.toContain('Frontend Engineer USonly');
  });

  it('does not re-analyze cached jobs on a second run', async () => {
    const plan1 = await planAnalysis(handle.db, candidate);
    await runAnalysis(handle.db, candidate, new CountingAnalyzer(), plan1);

    const plan2 = await planAnalysis(handle.db, candidate);
    expect(plan2.alreadyCached).toBe(2);
    expect(plan2.wouldAnalyze).toBe(0);
    const counter = new CountingAnalyzer();
    const stats = await runAnalysis(handle.db, candidate, counter, plan2);
    expect(stats.cacheHits).toBe(2);
    expect(stats.llmCalls).toBe(0);
    expect(counter.seen).toHaveLength(0);
  });

  it('invalidates the cache when job content changes', async () => {
    await runAnalysis(handle.db, candidate, new CountingAnalyzer(), await planAnalysis(handle.db, candidate));
    // Change one job's title.
    const [elig] = await handle.db.select().from(jobs).where(eq(jobs.canonicalUrl, 'https://x/elig'));
    await handle.db.update(jobs).set({ title: 'Frontend Engineer EU (updated)' }).where(eq(jobs.id, elig!.id));

    const plan = await planAnalysis(handle.db, candidate);
    expect(plan.wouldAnalyze).toBe(1);
  });

  it('invalidates the cache when the profile version changes', async () => {
    await runAnalysis(handle.db, candidate, new CountingAnalyzer(), await planAnalysis(handle.db, candidate));
    const bumped: CandidateAnalysis = { ...candidate, profileVersion: `${candidate.profileVersion}-changed` };
    const plan = await planAnalysis(handle.db, bumped);
    expect(plan.wouldAnalyze).toBe(2);
    expect(plan.alreadyCached).toBe(0);
  });

  it('fails safe on a throwing/malformed analyzer (nothing persisted)', async () => {
    const plan = await planAnalysis(handle.db, candidate);
    const stats = await runAnalysis(handle.db, candidate, new ThrowingAnalyzer(), plan);
    expect(stats.failed).toBe(2);
    expect(stats.analyzed).toBe(0);
    const user = await usersRepo.getFirstUser(handle.db);
    const analyzed = await matchesRepo.listAnalyzedWithJobs(handle.db, user!.id);
    expect(analyzed).toHaveLength(0);
  });
});
