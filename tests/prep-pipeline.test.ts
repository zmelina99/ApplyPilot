import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import type { Job } from '../src/db/schema/jobs.js';
import type { Fetcher } from '../src/prep/resolve.js';
import { prepareApplication, applyUserAnswer, approvePreparation, dryRunEligible, prepareEligible } from '../src/prep/prepare.js';
import { usersRepo, jobsRepo, jobSourcesRepo, matchesRepo, applicationsRepo, eventsRepo, prepRepo, automationRepo } from '../src/repositories/index.js';

// --- Greenhouse fixtures keyed by job id embedded in the canonical URL (gh-<id>) ---
const gh = (label: string, name: string, type: string, required: boolean, values?: { label: string; value: number }[]) =>
  ({ label, required, fields: [{ name, type, ...(values ? { values } : {}) }] });
const FIXTURES: Record<string, { questions: unknown[] }> = {
  '111': { questions: [gh('First Name', 'first_name', 'input_text', true), gh('Email', 'email', 'input_text', true), gh('LinkedIn', 'linkedin', 'input_text', false)] },
  '222': { questions: [gh('First Name', 'first_name', 'input_text', true), gh('Email', 'email', 'input_text', true), gh('Are you authorized to work in the US?', 'work_auth', 'input_text', true)] },
  '333': { questions: [gh('First Name', 'first_name', 'input_text', true), gh('Email', 'email', 'input_text', true), gh('Why do you want to work here?', 'why', 'textarea', true)] },
};

function fakeFetcher(opts: { loginFor?: string } = {}): { f: Fetcher; calls: string[] } {
  const calls: string[] = [];
  const f: Fetcher = async (url) => {
    calls.push(url);
    if (url.includes('boards-api.greenhouse.io')) {
      const id = url.match(/jobs\/(\d+)/)?.[1] ?? '';
      if (opts.loginFor === id) return { status: 401, finalUrl: url, text: '' };
      const fx = FIXTURES[id];
      return fx ? { status: 200, finalUrl: url, text: JSON.stringify(fx) } : { status: 404, finalUrl: url, text: '{}' };
    }
    if (url.includes('remotive.com')) {
      const id = url.match(/gh-(\d+)/)?.[1] ?? '111';
      return { status: 200, finalUrl: url, text: `<a href="https://boards.greenhouse.io/acme/jobs/${id}">Apply for this position</a>` };
    }
    return { status: 200, finalUrl: url, text: 'ok' };
  };
  return { f, calls };
}

async function makeJob(db: DbHandle['db'], p: { source: string; canonical: string; company?: string; title?: string; location?: string }): Promise<Job> {
  const job = await jobsRepo.upsertJob(db, {
    canonicalUrl: p.canonical, companyName: p.company ?? 'Acme', title: p.title ?? 'Frontend Engineer',
    locationText: p.location ?? 'Remote — Europe', remoteType: 'REMOTE',
  });
  await jobSourcesRepo.attachSource(db, { jobId: job.id, sourceName: p.source, sourceUrl: p.canonical, sourceJobId: null });
  const user = (await usersRepo.getFirstUser(db)) ?? (await usersRepo.createUser(db, { displayName: 'Local User' }));
  const m = await matchesRepo.createMatch(db, user.id, job.id);
  await matchesRepo.updateEvaluation(db, m.id, { status: 'QUALIFIED', eligibilityStatus: 'ELIGIBLE' });
  return job;
}

describe('supervised application preparation', () => {
  let handle: DbHandle;
  beforeAll(async () => { handle = await openTestDb(); });
  afterAll(async () => { await handle.close(); });
  beforeEach(async () => { await resetDb(handle.db); });

  it('prepares a supported Greenhouse form to READY_FOR_APPROVAL', async () => {
    const job = await makeJob(handle.db, { source: 'remotive', canonical: 'https://remotive.com/remote-jobs/x/gh-111' });
    const { f } = fakeFetcher();
    const s = await prepareApplication(handle.db, job.id, { fetcher: f });
    expect(s.provider).toBe('GREENHOUSE');
    expect(s.supported).toBe(true);
    expect(s.status).toBe('READY_FOR_APPROVAL');
    const events = await eventsRepo.getApplicationHistory(handle.db, s.applicationId!);
    const types = events.map((e) => e.eventType);
    expect(types).toContain('PROVIDER_DETECTED');
    expect(types).toContain('FORM_INSPECTED');
    expect(types).toContain('PREPARATION_VALIDATED');
  });

  it('routes required-but-unanswerable questions to NEEDS_USER_INPUT', async () => {
    const job = await makeJob(handle.db, { source: 'remotive', canonical: 'https://remotive.com/remote-jobs/x/gh-222' });
    const s = await prepareApplication(handle.db, job.id, { fetcher: fakeFetcher().f });
    expect(s.status).toBe('NEEDS_USER_INPUT');
    expect(s.answers.needsInput).toBeGreaterThanOrEqual(1);
  });

  it('marks free-text as NEEDS_GENERATION and blocks (no LLM)', async () => {
    const job = await makeJob(handle.db, { source: 'remotive', canonical: 'https://remotive.com/remote-jobs/x/gh-333' });
    const s = await prepareApplication(handle.db, job.id, { fetcher: fakeFetcher().f });
    expect(s.status).toBe('NEEDS_USER_INPUT');
    expect(s.answers.needsGeneration).toBe(1);
  });

  it('is idempotent — no duplicate application per (user, job)', async () => {
    const job = await makeJob(handle.db, { source: 'remotive', canonical: 'https://remotive.com/remote-jobs/x/gh-111' });
    const a = await prepareApplication(handle.db, job.id, { fetcher: fakeFetcher().f });
    const b = await prepareApplication(handle.db, job.id, { fetcher: fakeFetcher().f });
    expect(b.applicationId).toBe(a.applicationId);
    const user = await usersRepo.getFirstUser(handle.db);
    expect(await applicationsRepo.listApplicationsForUser(handle.db, user!.id)).toHaveLength(1);
  });

  it('routes unsupported/aggregator-gated providers to MANUAL_REVIEW with standard answers', async () => {
    const job = await makeJob(handle.db, { source: 'jobicy', canonical: 'https://jobicy.com/jobs/999-x' });
    const s = await prepareApplication(handle.db, job.id, { fetcher: fakeFetcher().f });
    expect(s.provider).toBe('AGGREGATOR');
    expect(s.status).toBe('MANUAL_REVIEW');
    const form = await prepRepo.getPreparedForm(handle.db, s.applicationId!);
    expect(form.length).toBeGreaterThan(0);
    expect(form.every((r) => r.question.sourceKind === 'STANDARD')).toBe(true);
  });

  it('detects login-required destinations', async () => {
    const job = await makeJob(handle.db, { source: 'remotive', canonical: 'https://remotive.com/remote-jobs/x/gh-111' });
    const s = await prepareApplication(handle.db, job.id, { fetcher: fakeFetcher({ loginFor: '111' }).f });
    expect(s.status).toBe('LOGIN_REQUIRED');
  });

  it('records user answers, revalidates to READY, and never auto-submits', async () => {
    const job = await makeJob(handle.db, { source: 'remotive', canonical: 'https://remotive.com/remote-jobs/x/gh-222' });
    const s = await prepareApplication(handle.db, job.id, { fetcher: fakeFetcher().f });
    const form = await prepRepo.getPreparedForm(handle.db, s.applicationId!);
    const wa = form.find((r) => r.question.category === 'WORK_AUTHORIZATION')!;
    await applyUserAnswer(handle.db, wa.question.id, 'Authorized in the EU', { reusable: false });
    const after = await applicationsRepo.getApplication(handle.db, s.applicationId!);
    expect(after!.status).toBe('READY_FOR_APPROVAL');
    // No submission ever.
    const events = await eventsRepo.getApplicationHistory(handle.db, s.applicationId!);
    expect(events.map((e) => e.eventType)).toContain('USER_ANSWERED');
    expect(events.map((e) => e.eventType)).not.toContain('APPLICATION_SUBMITTED');
    expect(after!.status).not.toBe('APPLIED');
  });

  it('saves reusable answers only on explicit opt-in and reuses them', async () => {
    const j1 = await makeJob(handle.db, { source: 'remotive', canonical: 'https://remotive.com/remote-jobs/x/gh-222' });
    const s1 = await prepareApplication(handle.db, j1.id, { fetcher: fakeFetcher().f });
    const form1 = await prepRepo.getPreparedForm(handle.db, s1.applicationId!);
    const wa1 = form1.find((r) => r.question.category === 'WORK_AUTHORIZATION')!;
    await applyUserAnswer(handle.db, wa1.question.id, 'Authorized in the EU', { reusable: true });
    const user = await usersRepo.getFirstUser(handle.db);
    expect((await prepRepo.getSavedAnswersMap(handle.db, user!.id)).get('WORK_AUTHORIZATION')).toBe('Authorized in the EU');

    // A different job with the same (work-auth) form is now auto-answered from the saved answer.
    const j3 = await makeJob(handle.db, { source: 'remotive', canonical: 'https://remotive.com/remote-jobs/x/gh-222-two', company: 'Beta' });
    const s3 = await prepareApplication(handle.db, j3.id, { fetcher: fakeFetcher().f });
    const form3 = await prepRepo.getPreparedForm(handle.db, s3.applicationId!);
    const wa3 = form3.find((r) => r.question.category === 'WORK_AUTHORIZATION')!;
    expect(wa3.answer.status).toBe('READY');
    expect(wa3.answer.answerSource).toBe('APPROVED_ANSWER');
  });

  it('approve marks reviewed + counts toward supervision, but does NOT submit', async () => {
    const job = await makeJob(handle.db, { source: 'remotive', canonical: 'https://remotive.com/remote-jobs/x/gh-111' });
    const s = await prepareApplication(handle.db, job.id, { fetcher: fakeFetcher().f });
    await approvePreparation(handle.db, s.applicationId!);
    const after = await applicationsRepo.getApplication(handle.db, s.applicationId!);
    expect(after!.status).toBe('READY_FOR_APPROVAL'); // approval ≠ submission
    const events = await eventsRepo.getApplicationHistory(handle.db, s.applicationId!);
    expect(events.map((e) => e.eventType)).toContain('PREPARATION_APPROVED');
    expect(events.map((e) => e.eventType)).not.toContain('APPLICATION_SUBMITTED');
    const user = await usersRepo.getFirstUser(handle.db);
    const settings = await automationRepo.getSettings(handle.db, user!.id);
    expect(settings!.initialReviewCount).toBe(1);
    expect(settings!.automationEnabled).toBe(false); // never auto-enabled
  });

  it('dry-run makes no DB writes', async () => {
    await makeJob(handle.db, { source: 'jobicy', canonical: 'https://jobicy.com/jobs/1-a' });
    await makeJob(handle.db, { source: 'remotive', canonical: 'https://remotive.com/remote-jobs/x/gh-111', company: 'B' });
    const user = await usersRepo.getFirstUser(handle.db);
    const before = (await applicationsRepo.listApplicationsForUser(handle.db, user!.id)).length;
    const report = await dryRunEligible(handle.db, { fetcher: fakeFetcher().f });
    expect(report.considered).toBe(2);
    expect(report.byProvider['GREENHOUSE']).toBe(1);
    expect(report.gated).toBe(1);
    const after = (await applicationsRepo.listApplicationsForUser(handle.db, user!.id)).length;
    expect(after).toBe(before); // no applications created by dry-run
  });

  it('batch prepare only creates one application per eligible job', async () => {
    await makeJob(handle.db, { source: 'remotive', canonical: 'https://remotive.com/remote-jobs/x/gh-111' });
    await makeJob(handle.db, { source: 'jobicy', canonical: 'https://jobicy.com/jobs/2-b', company: 'B' });
    const results = await prepareEligible(handle.db, { fetcher: fakeFetcher().f });
    expect(results).toHaveLength(2);
    const user = await usersRepo.getFirstUser(handle.db);
    expect(await applicationsRepo.listApplicationsForUser(handle.db, user!.id)).toHaveLength(2);
  });
});
