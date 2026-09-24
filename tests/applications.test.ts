import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import { usersRepo, jobsRepo, applicationsRepo } from '../src/repositories/index.js';
import { InvalidTransitionError } from '../src/domain/errors.js';

async function fixture(handle: DbHandle) {
  const user = await usersRepo.createUser(handle.db);
  const job = await jobsRepo.upsertJob(handle.db, {
    canonicalUrl: `https://jobs.example/a/${crypto.randomUUID()}`,
  });
  return { user, job };
}

describe('applications & state machine', () => {
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

  it('creates an application in QUEUED', async () => {
    const { user, job } = await fixture(handle);
    const app = await applicationsRepo.createApplication(handle.db, user.id, job.id);
    expect(app.status).toBe('QUEUED');
    expect(app.attemptCount).toBe(0);
  });

  it('prevents duplicate (user_id, job_id) applications', async () => {
    const { user, job } = await fixture(handle);
    await applicationsRepo.createApplication(handle.db, user.id, job.id);
    await expect(
      applicationsRepo.createApplication(handle.db, user.id, job.id),
    ).rejects.toThrow();
    expect(
      await applicationsRepo.listApplicationsForUser(handle.db, user.id),
    ).toHaveLength(1);
  });

  it('allows a valid transition QUEUED -> APPLYING', async () => {
    const { user, job } = await fixture(handle);
    const app = await applicationsRepo.createApplication(handle.db, user.id, job.id);
    const moved = await applicationsRepo.transitionStatus(handle.db, app.id, 'APPLYING');
    expect(moved.status).toBe('APPLYING');
    expect(moved.startedAt).not.toBeNull();
  });

  it('rejects an invalid transition (QUEUED -> APPLIED) and leaves state unchanged', async () => {
    const { user, job } = await fixture(handle);
    const app = await applicationsRepo.createApplication(handle.db, user.id, job.id);
    await expect(
      applicationsRepo.transitionStatus(handle.db, app.id, 'APPLIED'),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    const after = await applicationsRepo.getApplication(handle.db, app.id);
    expect(after?.status).toBe('QUEUED');
  });

  it('makes APPLIED terminal (no restart to APPLYING)', async () => {
    const { user, job } = await fixture(handle);
    const app = await applicationsRepo.createApplication(handle.db, user.id, job.id);
    await applicationsRepo.transitionStatus(handle.db, app.id, 'APPLYING');
    await applicationsRepo.transitionStatus(handle.db, app.id, 'APPLIED');
    await expect(
      applicationsRepo.transitionStatus(handle.db, app.id, 'APPLYING'),
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    const after = await applicationsRepo.getApplication(handle.db, app.id);
    expect(after?.status).toBe('APPLIED');
    expect(after?.submittedAt).not.toBeNull();
  });

  it('increments attempt_count atomically under concurrency', async () => {
    const { user, job } = await fixture(handle);
    const app = await applicationsRepo.createApplication(handle.db, user.id, job.id);
    await Promise.all(
      Array.from({ length: 10 }, () =>
        applicationsRepo.incrementAttemptCount(handle.db, app.id),
      ),
    );
    const after = await applicationsRepo.getApplication(handle.db, app.id);
    expect(after?.attemptCount).toBe(10);
  });
});
