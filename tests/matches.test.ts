import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import { usersRepo, jobsRepo, matchesRepo } from '../src/repositories/index.js';
import { jobMatches } from '../src/db/schema/index.js';

describe('job matches', () => {
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

  it('prevents duplicate (user_id, job_id) matches at the DB level', async () => {
    const user = await usersRepo.createUser(handle.db);
    const job = await jobsRepo.upsertJob(handle.db, {
      canonicalUrl: 'https://jobs.example/m/1',
    });

    // Repo get-or-create returns the same row (idempotent).
    const m1 = await matchesRepo.createMatch(handle.db, user.id, job.id);
    const m2 = await matchesRepo.createMatch(handle.db, user.id, job.id);
    expect(m2.id).toBe(m1.id);

    // A raw second insert must be rejected by the unique constraint.
    await expect(
      handle.db.insert(jobMatches).values({ userId: user.id, jobId: job.id }),
    ).rejects.toThrow();

    const rows = await handle.db
      .select()
      .from(jobMatches)
      .where(eq(jobMatches.userId, user.id));
    expect(rows).toHaveLength(1);
  });

  it('records evaluation results and stamps evaluated_at', async () => {
    const user = await usersRepo.createUser(handle.db);
    const job = await jobsRepo.upsertJob(handle.db, {
      canonicalUrl: 'https://jobs.example/m/2',
    });
    const match = await matchesRepo.createMatch(handle.db, user.id, job.id);
    expect(match.evaluatedAt).toBeNull();

    const evaluated = await matchesRepo.updateEvaluation(handle.db, match.id, {
      status: 'QUALIFIED',
      eligibilityStatus: 'ELIGIBLE',
      fitStatus: 'STRONG',
      fitScore: 88,
      fitReason: 'strong',
    });
    expect(evaluated.status).toBe('QUALIFIED');
    expect(evaluated.fitScore).toBe(88);
    expect(evaluated.evaluatedAt).not.toBeNull();
  });
});
