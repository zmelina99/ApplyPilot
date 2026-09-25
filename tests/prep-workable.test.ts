import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import type { Job } from '../src/db/schema/jobs.js';
import { prepareApplication } from '../src/prep/prepare.js';
import { inspectDestination, type Fetcher } from '../src/prep/resolve.js';
import { classifyQuestion } from '../src/prep/classify.js';
import { answerQuestion, type AnswerContext } from '../src/prep/answer.js';
import { normalizeWorkableFields } from '../src/prep/workableInspector.js';
import { loadApplicationDefaults } from '../src/config/applicationDefaults.js';
import { loadCandidateFacts } from '../src/config/candidateFacts.js';
import { loadSearchConfig } from '../src/config/searchConfig.js';
import { usersRepo, jobsRepo, jobSourcesRepo, matchesRepo, prepRepo } from '../src/repositories/index.js';
import { koboQuestionsFixture } from './fixtures/kobo-workable.js';

function koboQuestions() {
  return koboQuestionsFixture();
}

function testCtx(over: Partial<AnswerContext> = {}): AnswerContext {
  return {
    facts: loadCandidateFacts(),
    identity: { fullName: 'Test User', email: 't@example.com', phone: null, location: null, linkedinUrl: null, githubUrl: null, portfolioUrl: null },
    salary: loadSearchConfig().salary,
    applicationDefaults: loadApplicationDefaults(),
    swissRole: false,
    resumeAvailable: true,
    saved: new Map(),
    referenceDate: new Date('2026-09-25T12:00:00Z'),
    ...over,
  };
}

async function makeWorkableJob(db: DbHandle['db']): Promise<Job> {
  const job = await jobsRepo.upsertJob(db, {
    canonicalUrl: 'https://apply.workable.com/kobotoolbox/j/588D5CF127/apply/',
    companyName: 'KoboToolbox',
    title: 'Frontend Web Application Developer',
    locationText: 'Remote — Argentina',
    remoteType: 'REMOTE',
  });
  await jobSourcesRepo.attachSource(db, { jobId: job.id, sourceName: 'direct', sourceUrl: job.canonicalUrl, sourceJobId: null });
  const user = (await usersRepo.getFirstUser(db)) ?? (await usersRepo.createUser(db, { displayName: 'Local User' }));
  const m = await matchesRepo.createMatch(db, user.id, job.id);
  await matchesRepo.updateEvaluation(db, m.id, { status: 'QUALIFIED', eligibilityStatus: 'ELIGIBLE' });
  return job;
}

describe('Workable form inspection', () => {
  it('normalizes the KoboToolbox field set without generic standard questions', () => {
    const qs = koboQuestions();
    expect(qs).toHaveLength(11);
    expect(qs.map((q) => q.providerFieldId)).toEqual([
      'firstname', 'lastname', 'email', 'resume', 'QA_12317170', 'QA_12317171',
      'QA_12317172', 'QA_12317173', 'QA_12317174', 'QA_12317175', 'QA_12317176',
    ]);
    expect(qs.some((q) => /linkedin|work authorization|phone/i.test(q.label))).toBe(false);
  });

  it('classifies and answers deterministic Kobo fields', () => {
    const ctx = testCtx();
    const ref = new Date('2026-09-25T12:00:00Z');
    const rows = koboQuestions().map((q) => {
      const category = classifyQuestion(q.label, q.fieldType);
      const answer = answerQuestion(
        { label: q.label, category, fieldType: q.fieldType, required: q.required, options: q.options ?? null, placeholder: q.placeholder ?? null },
        { ...ctx, referenceDate: ref },
      );
      return { label: q.label, category, status: answer.status, value: answer.value };
    });
    expect(rows.find((r) => r.label === 'First name')).toMatchObject({ status: 'READY', value: 'Test' });
    expect(rows.find((r) => r.label === 'Last name')).toMatchObject({ status: 'READY', value: 'User' });
    expect(rows.find((r) => r.label === 'Email')).toMatchObject({ status: 'READY' });
    expect(rows.find((r) => r.label.startsWith('When could you begin'))).toMatchObject({ status: 'READY', value: '09/25/2026' });
    expect(rows.find((r) => r.label.includes('hours'))).toMatchObject({ status: 'READY', value: '40' });
    expect(rows.find((r) => r.label.includes('Country'))).toMatchObject({ status: 'READY', value: 'Spain' });
    expect(rows.find((r) => r.label.includes('USD'))).toMatchObject({ status: 'READY', value: '35' });
    expect(rows.find((r) => r.label.startsWith('Tell us with specific detail'))).toMatchObject({ status: 'NEEDS_GENERATION', category: 'FREE_TEXT' });
    expect(rows.filter((r) => r.status === 'NEEDS_GENERATION')).toHaveLength(2);
  });

  it('routes Workable through inspectDestination with an injected inspector', async () => {
    const result = await inspectDestination(
      { applyUrl: 'https://apply.workable.com/kobotoolbox/j/588D5CF127/apply/', provider: 'WORKABLE', gated: false },
      (async () => ({ status: 200, finalUrl: '', text: '' })) as Fetcher,
      {
        inspectWorkable: async () => ({
          supported: true, loginRequired: false, captcha: false, questions: koboQuestions(), note: null,
        }),
      },
    );
    expect(result.supported).toBe(true);
    expect(result.questions).toHaveLength(11);
  });
});

describe('Workable application preparation', () => {
  let handle: DbHandle;
  beforeAll(async () => { handle = await openTestDb(); });
  afterAll(async () => { await handle.close(); });
  beforeEach(async () => { await resetDb(handle.db); });

  it('persists real Workable questions instead of the standard question set', async () => {
    const job = await makeWorkableJob(handle.db);
    const summary = await prepareApplication(handle.db, job.id, {
      fetcher: async (url) => ({ status: 200, finalUrl: url, text: 'ok' }),
      inspectWorkable: async () => ({
        supported: true, loginRequired: false, captcha: false, questions: koboQuestions(), note: null,
      }),
    });
    expect(summary.provider).toBe('WORKABLE');
    expect(summary.supported).toBe(true);
    expect(summary.questionCount).toBe(11);
    expect(summary.status).toBe('NEEDS_USER_INPUT');
    expect(summary.answers.ready).toBeGreaterThanOrEqual(7);
    expect(summary.answers.needsGeneration).toBe(2);
    expect(summary.answers.needsInput).toBe(1);

    const form = await prepRepo.getPreparedForm(handle.db, summary.applicationId!);
    expect(form.every((r) => r.question.sourceKind === 'PROVIDER_FORM')).toBe(true);
    expect(form.some((r) => /LinkedIn|work authorization|Phone number/i.test(r.question.label))).toBe(false);
    expect(form.some((r) => r.question.providerFieldId === 'QA_12317170')).toBe(true);
  });
});
