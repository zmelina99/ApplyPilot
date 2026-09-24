import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import { usersRepo, automationRepo } from '../src/repositories/index.js';

describe('automation safety invariants', () => {
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

  it('defaults a new user to automation disabled, target 20, NOT_REQUESTED', async () => {
    const user = await usersRepo.createUser(handle.db);
    const s = await automationRepo.getSettings(handle.db, user.id);
    expect(s?.automationEnabled).toBe(false);
    expect(s?.initialReviewTarget).toBe(20);
    expect(s?.initialReviewCount).toBe(0);
    expect(s?.automationApprovalStatus).toBe('NOT_REQUESTED');
  });

  it('reaching the review target does NOT enable automation, but requests approval', async () => {
    const user = await usersRepo.createUser(handle.db);
    let s = await automationRepo.getSettings(handle.db, user.id);
    for (let i = 0; i < (s?.initialReviewTarget ?? 20); i++) {
      s = await automationRepo.incrementReviewedCount(handle.db, user.id);
    }
    expect(s?.initialReviewCount).toBe(20);
    // CRITICAL: still disabled.
    expect(s?.automationEnabled).toBe(false);
    // Moved to the approval gate.
    expect(s?.automationApprovalStatus).toBe('AWAITING_AUTOMATION_APPROVAL');
  });

  it('requires explicit approval to enable automation', async () => {
    const user = await usersRepo.createUser(handle.db);
    for (let i = 0; i < 20; i++) {
      await automationRepo.incrementReviewedCount(handle.db, user.id);
    }
    let s = await automationRepo.getSettings(handle.db, user.id);
    expect(s?.automationEnabled).toBe(false);

    const approved = await automationRepo.approveAutomation(handle.db, user.id);
    expect(approved.automationEnabled).toBe(true);
    expect(approved.automationApprovalStatus).toBe('APPROVED');

    s = await automationRepo.getSettings(handle.db, user.id);
    expect(s?.automationEnabled).toBe(true);
  });

  it('decline keeps automation disabled', async () => {
    const user = await usersRepo.createUser(handle.db);
    const declined = await automationRepo.declineAutomation(handle.db, user.id);
    expect(declined.automationEnabled).toBe(false);
    expect(declined.automationApprovalStatus).toBe('DECLINED');
  });

  it('increments the reviewed count atomically', async () => {
    const user = await usersRepo.createUser(handle.db);
    await Promise.all(
      Array.from({ length: 5 }, () =>
        automationRepo.incrementReviewedCount(handle.db, user.id),
      ),
    );
    const s = await automationRepo.getSettings(handle.db, user.id);
    expect(s?.initialReviewCount).toBe(5);
  });
});
