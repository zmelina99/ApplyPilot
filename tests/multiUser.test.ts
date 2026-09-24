import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import {
  usersRepo,
  jobsRepo,
  matchesRepo,
  applicationsRepo,
} from '../src/repositories/index.js';

describe('multi-user isolation on a shared global job', () => {
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

  it('lets multiple users match/apply to the SAME job without duplicating it', async () => {
    const userA = await usersRepo.createUser(handle.db, { displayName: 'A' });
    const userB = await usersRepo.createUser(handle.db, { displayName: 'B' });
    const userC = await usersRepo.createUser(handle.db, { displayName: 'C' });

    const job = await jobsRepo.upsertJob(handle.db, {
      canonicalUrl: 'https://jobs.example/shared/job-x',
      title: 'Frontend Engineer',
    });

    // A likes (qualified), B rejects, C applies — all on one global job row.
    const mA = await matchesRepo.createMatch(handle.db, userA.id, job.id);
    await matchesRepo.updateEvaluation(handle.db, mA.id, {
      status: 'QUALIFIED',
      eligibilityStatus: 'ELIGIBLE',
      fitStatus: 'STRONG',
      fitScore: 90,
    });
    const mB = await matchesRepo.createMatch(handle.db, userB.id, job.id);
    await matchesRepo.updateEvaluation(handle.db, mB.id, {
      status: 'REJECTED',
      eligibilityStatus: 'INELIGIBLE',
      fitStatus: 'WEAK',
      fitScore: 20,
    });
    await matchesRepo.createMatch(handle.db, userC.id, job.id);
    await applicationsRepo.createApplication(handle.db, userC.id, job.id);

    // Still exactly ONE global job.
    expect(await jobsRepo.listJobs(handle.db)).toHaveLength(1);

    // Per-user match state is independent.
    const gotA = await matchesRepo.getMatch(handle.db, userA.id, job.id);
    const gotB = await matchesRepo.getMatch(handle.db, userB.id, job.id);
    expect(gotA?.status).toBe('QUALIFIED');
    expect(gotB?.status).toBe('REJECTED');

    // Applications are per-user: C has one, A has none.
    expect(await applicationsRepo.listApplicationsForUser(handle.db, userC.id)).toHaveLength(1);
    expect(await applicationsRepo.listApplicationsForUser(handle.db, userA.id)).toHaveLength(0);
  });
});
