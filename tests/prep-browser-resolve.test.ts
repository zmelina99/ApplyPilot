import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import type { Job } from '../src/db/schema/jobs.js';
import type { Fetcher } from '../src/prep/resolve.js';
import { resolveApplyUrl } from '../src/prep/resolve.js';
import type { BrowserResolver } from '../src/prep/browserResolver.js';
import { prepareApplication, resolveGated } from '../src/prep/prepare.js';
import { usersRepo, jobsRepo, jobSourcesRepo, matchesRepo, applicationsRepo, eventsRepo, prepRepo } from '../src/repositories/index.js';

const FIXTURES: Record<string, { questions: unknown[] }> = {
  '111': { questions: [
    { label: 'First Name', required: true, fields: [{ name: 'first_name', type: 'input_text' }] },
    { label: 'Email', required: true, fields: [{ name: 'email', type: 'input_text' }] },
  ] },
};
const fakeFetcher = (): Fetcher => async (url) => {
  if (url.includes('boards-api.greenhouse.io')) {
    const id = url.match(/jobs\/(\d+)/)?.[1] ?? '';
    return FIXTURES[id] ? { status: 200, finalUrl: url, text: JSON.stringify(FIXTURES[id]) } : { status: 404, finalUrl: url, text: '{}' };
  }
  return { status: 200, finalUrl: url, text: 'ok' };
};

// Mocked browser resolvers (no Playwright, no network).
const resolvesToGreenhouse: BrowserResolver = { resolve: async () => ({ finalUrl: 'https://boards.greenhouse.io/acme/jobs/111', loginRequired: false }) };
const loginWall: BrowserResolver = { resolve: async () => ({ finalUrl: null, loginRequired: true, note: 'sign-in wall' }) };
const stillGated: BrowserResolver = { resolve: async () => ({ finalUrl: null, loginRequired: false }) };

async function makeJobicyJob(db: DbHandle['db'], canonical: string, title = 'Frontend Engineer'): Promise<Job> {
  const job = await jobsRepo.upsertJob(db, { canonicalUrl: canonical, companyName: 'Acme', title, locationText: 'Remote — Europe', remoteType: 'REMOTE' });
  await jobSourcesRepo.attachSource(db, { jobId: job.id, sourceName: 'jobicy', sourceUrl: canonical, sourceJobId: null });
  const user = (await usersRepo.getFirstUser(db)) ?? (await usersRepo.createUser(db, { displayName: 'Local User' }));
  const m = await matchesRepo.createMatch(db, user.id, job.id);
  await matchesRepo.updateEvaluation(db, m.id, { status: 'QUALIFIED', eligibilityStatus: 'ELIGIBLE' });
  return job;
}

describe('resolveApplyUrl with a browser resolver (unit)', () => {
  it('resolves a Jobicy destination to the real ATS', async () => {
    const r = await resolveApplyUrl('https://jobicy.com/jobs/1-x', 'jobicy', fakeFetcher(), resolvesToGreenhouse);
    expect(r.gated).toBe(false);
    expect(r.provider).toBe('GREENHOUSE');
    expect(r.applyUrl).toContain('greenhouse.io');
  });
  it('reports loginRequired when the aggregator gates behind sign-in (never bypassed)', async () => {
    const r = await resolveApplyUrl('https://jobicy.com/jobs/1-x', 'jobicy', fakeFetcher(), loginWall);
    expect(r.gated).toBe(true);
    expect(r.loginRequired).toBe(true);
    expect(r.provider).toBe('AGGREGATOR');
  });
  it('stays gated (no browser resolver) — backward compatible', async () => {
    const r = await resolveApplyUrl('https://jobicy.com/jobs/1-x', 'jobicy', fakeFetcher());
    expect(r.gated).toBe(true);
    expect(r.provider).toBe('AGGREGATOR');
  });
});

describe('resolveGated pipeline (mocked browser)', () => {
  let handle: DbHandle;
  beforeAll(async () => { handle = await openTestDb(); });
  afterAll(async () => { await handle.close(); });
  beforeEach(async () => { await resetDb(handle.db); });

  it('moves a gated app to a real Greenhouse READY_FOR_APPROVAL', async () => {
    const job = await makeJobicyJob(handle.db, 'https://jobicy.com/jobs/1-a');
    const first = await prepareApplication(handle.db, job.id, { fetcher: fakeFetcher() });
    expect(first.status).toBe('MANUAL_REVIEW');
    expect(first.provider).toBe('AGGREGATOR');

    const report = await resolveGated(handle.db, { browserResolver: resolvesToGreenhouse, fetcher: fakeFetcher() });
    expect(report.considered).toBe(1);
    expect(report.resolved).toBe(1);
    const app = await applicationsRepo.getApplication(handle.db, first.applicationId!);
    expect(app!.provider).toBe('GREENHOUSE');
    expect(app!.status).toBe('READY_FOR_APPROVAL');
    expect(app!.formUnderstood).toBe(true);
  });

  it('records LOGIN_REQUIRED for sign-in-gated destinations without logging in', async () => {
    const job = await makeJobicyJob(handle.db, 'https://jobicy.com/jobs/1-b');
    const first = await prepareApplication(handle.db, job.id, { fetcher: fakeFetcher() });
    const report = await resolveGated(handle.db, { browserResolver: loginWall, fetcher: fakeFetcher() });
    expect(report.loginRequired).toBe(1);
    const app = await applicationsRepo.getApplication(handle.db, first.applicationId!);
    expect(app!.status).toBe('LOGIN_REQUIRED');
    expect(app!.provider).toBe('AGGREGATOR');
  });

  it('leaves truly-unresolvable apps gated (MANUAL_REVIEW)', async () => {
    const job = await makeJobicyJob(handle.db, 'https://jobicy.com/jobs/1-c');
    await prepareApplication(handle.db, job.id, { fetcher: fakeFetcher() });
    const report = await resolveGated(handle.db, { browserResolver: stillGated, fetcher: fakeFetcher() });
    expect(report.stillGated).toBe(1);
    expect(report.resolved).toBe(0);
  });

  it('is idempotent and never submits', async () => {
    const job = await makeJobicyJob(handle.db, 'https://jobicy.com/jobs/1-a');
    const first = await prepareApplication(handle.db, job.id, { fetcher: fakeFetcher() });
    await resolveGated(handle.db, { browserResolver: resolvesToGreenhouse, fetcher: fakeFetcher() });
    await resolveGated(handle.db, { browserResolver: resolvesToGreenhouse, fetcher: fakeFetcher() });
    const user = await usersRepo.getFirstUser(handle.db);
    expect(await applicationsRepo.listApplicationsForUser(handle.db, user!.id)).toHaveLength(1);
    const events = await eventsRepo.getApplicationHistory(handle.db, first.applicationId!);
    expect(events.map((e) => e.eventType)).not.toContain('APPLICATION_SUBMITTED');
    const app = await applicationsRepo.getApplication(handle.db, first.applicationId!);
    expect(app!.status).not.toBe('APPLIED');
    // preserved USER answers survive re-resolution
    const form = await prepRepo.getPreparedForm(handle.db, first.applicationId!);
    expect(form.length).toBeGreaterThan(0);
  });
});
