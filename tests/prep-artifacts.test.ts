import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import {
  encodeLocalFile, isManualArtifact, listApprovedLocalFiles, parseLocalFile, validateLocalFile,
} from '../src/prep/artifacts.js';
import { applyUserAnswer, prepareApplication } from '../src/prep/prepare.js';
import { applicationsRepo, jobsRepo, jobSourcesRepo, matchesRepo, prepRepo, usersRepo } from '../src/repositories/index.js';
import { koboQuestionsFixture } from './fixtures/kobo-workable.js';

describe('local application artifacts', () => {
  it('lists and validates files under resumes/', () => {
    const dir = mkdtempSync(join(tmpdir(), 'applypilot-artifacts-'));
    writeFileSync(join(dir, 'notes.zip'), 'zip');
    writeFileSync(join(dir, 'README.md'), 'readme');
    expect(listApprovedLocalFiles(dir)).toEqual(['notes.zip']);
    expect(validateLocalFile('notes.zip', dir)).toBe(true);
    expect(validateLocalFile('../escape.pdf', dir)).toBe(false);
    expect(encodeLocalFile('notes.zip')).toBe('[LOCAL_FILE:notes.zip]');
    expect(parseLocalFile('[LOCAL_FILE:notes.zip]')).toBe('notes.zip');
    expect(isManualArtifact('[MANUAL_AT_APPLY_TIME]')).toBe(true);
  });
});

describe('Workable workspace resolution', () => {
  let handle: DbHandle;
  beforeAll(async () => { handle = await openTestDb(); });
  afterAll(async () => { await handle.close(); });
  beforeEach(async () => { await resetDb(handle.db); });

  it('reaches READY_FOR_APPROVAL after manual text answers and manual file handling', async () => {
    const job = await jobsRepo.upsertJob(handle.db, {
      canonicalUrl: 'https://apply.workable.com/kobotoolbox/j/588D5CF127/apply/',
      companyName: 'KoboToolbox', title: 'Frontend Web Application Developer',
      locationText: 'Remote', remoteType: 'REMOTE',
    });
    await jobSourcesRepo.attachSource(handle.db, { jobId: job.id, sourceName: 'direct', sourceUrl: job.canonicalUrl, sourceJobId: null });
    const user = (await usersRepo.getFirstUser(handle.db)) ?? (await usersRepo.createUser(handle.db, { displayName: 'Local User' }));
    const m = await matchesRepo.createMatch(handle.db, user.id, job.id);
    await matchesRepo.updateEvaluation(handle.db, m.id, { status: 'QUALIFIED', eligibilityStatus: 'ELIGIBLE' });

    const summary = await prepareApplication(handle.db, job.id, {
      fetcher: async (url) => ({ status: 200, finalUrl: url, text: 'ok' }),
      inspectWorkable: async () => ({
        supported: true, loginRequired: false, captcha: false, questions: koboQuestionsFixture(), note: null,
      }),
    });
    expect(summary.status).toBe('NEEDS_USER_INPUT');

    const form = await prepRepo.getPreparedForm(handle.db, summary.applicationId!);
    await applyUserAnswer(handle.db, form.find((r) => r.question.providerFieldId === 'QA_12317170')!.question.id, 'Detailed qualifying work narrative.');
    await applyUserAnswer(handle.db, form.find((r) => r.question.providerFieldId === 'QA_12317171')!.question.id, 'Mission-aligned reasons to join Kobo.');
    await applyUserAnswer(handle.db, form.find((r) => r.question.providerFieldId === 'QA_12317174')!.question.id, '', { mode: 'manual' });

    const after = await applicationsRepo.getApplication(handle.db, summary.applicationId!);
    expect(after!.status).toBe('READY_FOR_APPROVAL');
    const finalForm = await prepRepo.getPreparedForm(handle.db, summary.applicationId!);
    expect(finalForm.every((r) => !r.question.required || r.answer.status === 'READY')).toBe(true);
    expect(finalForm.find((r) => r.question.providerFieldId === 'QA_12317174')!.answer.value).toBe('[MANUAL_AT_APPLY_TIME]');
  });
});
