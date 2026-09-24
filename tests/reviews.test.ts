import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import { usersRepo, reviewsRepo } from '../src/repositories/index.js';

describe('review queue', () => {
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

  it('creates, lists unresolved, and resolves review items', async () => {
    const user = await usersRepo.createUser(handle.db);

    const swiss = await reviewsRepo.createReviewItem(handle.db, {
      userId: user.id,
      reviewType: 'SWISS_APPLICATION',
      reason: 'Swiss role — always review.',
    });
    await reviewsRepo.createReviewItem(handle.db, {
      userId: user.id,
      reviewType: 'MISSING_INFORMATION',
      reason: 'Missing a mandatory field.',
    });

    let open = await reviewsRepo.listUnresolvedReviews(handle.db, user.id);
    expect(open).toHaveLength(2);
    expect(open.every((r) => r.status === 'OPEN')).toBe(true);

    const resolved = await reviewsRepo.resolveReviewItem(handle.db, swiss.id, 'RESOLVED');
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolvedAt).not.toBeNull();

    open = await reviewsRepo.listUnresolvedReviews(handle.db, user.id);
    expect(open).toHaveLength(1);
    expect(open[0]?.reviewType).toBe('MISSING_INFORMATION');
  });

  it('scopes review items to their owning user', async () => {
    const a = await usersRepo.createUser(handle.db);
    const b = await usersRepo.createUser(handle.db);
    await reviewsRepo.createReviewItem(handle.db, {
      userId: a.id,
      reviewType: 'OTHER',
    });
    expect(await reviewsRepo.listUnresolvedReviews(handle.db, a.id)).toHaveLength(1);
    expect(await reviewsRepo.listUnresolvedReviews(handle.db, b.id)).toHaveLength(0);
  });
});
