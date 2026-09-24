import { and, eq, desc } from 'drizzle-orm';
import type { Database, Exec } from '../db/client.js';
import { reviewItems } from '../db/schema/index.js';
import type { ReviewItem, NewReviewItem } from '../db/schema/reviewItems.js';
import { NotFoundError } from '../domain/errors.js';

export interface CreateReviewInput {
  userId: string;
  reviewType: NewReviewItem['reviewType'];
  jobId?: string | null;
  applicationId?: string | null;
  reason?: string | null;
  payload?: unknown;
}

export async function createReviewItem(
  exec: Exec,
  input: CreateReviewInput,
): Promise<ReviewItem> {
  const [row] = await exec
    .insert(reviewItems)
    .values({
      userId: input.userId,
      reviewType: input.reviewType,
      jobId: input.jobId ?? null,
      applicationId: input.applicationId ?? null,
      reason: input.reason ?? null,
      payload: (input.payload ?? null) as NewReviewItem['payload'],
    })
    .returning();
  if (!row) throw new Error('Failed to create review item');
  return row;
}

/** Unresolved (OPEN) review items for a user, newest first. */
export async function listUnresolvedReviews(
  exec: Exec,
  userId: string,
): Promise<ReviewItem[]> {
  return exec
    .select()
    .from(reviewItems)
    .where(and(eq(reviewItems.userId, userId), eq(reviewItems.status, 'OPEN')))
    .orderBy(desc(reviewItems.createdAt));
}

/**
 * Find an existing OPEN review item for a (user, job, reviewType). Used to keep
 * repeated discovery runs from creating duplicate review items.
 */
export async function findOpenReviewForJob(
  exec: Exec,
  userId: string,
  jobId: string,
  reviewType: NewReviewItem['reviewType'],
): Promise<ReviewItem | null> {
  const [row] = await exec
    .select()
    .from(reviewItems)
    .where(
      and(
        eq(reviewItems.userId, userId),
        eq(reviewItems.jobId, jobId),
        eq(reviewItems.reviewType, reviewType),
        eq(reviewItems.status, 'OPEN'),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Create a review item only if no matching OPEN one exists (idempotent). */
export async function createReviewIfAbsent(
  db: Database,
  input: CreateReviewInput,
): Promise<{ created: boolean; item: ReviewItem }> {
  if (input.jobId) {
    const existing = await findOpenReviewForJob(
      db,
      input.userId,
      input.jobId,
      input.reviewType,
    );
    if (existing) return { created: false, item: existing };
  }
  const item = await createReviewItem(db, input);
  return { created: true, item };
}

export async function getReviewItem(
  exec: Exec,
  id: string,
): Promise<ReviewItem | null> {
  const [row] = await exec
    .select()
    .from(reviewItems)
    .where(eq(reviewItems.id, id))
    .limit(1);
  return row ?? null;
}

export type ReviewResolution = 'RESOLVED' | 'DISMISSED';

export async function resolveReviewItem(
  db: Database,
  id: string,
  resolution: ReviewResolution = 'RESOLVED',
): Promise<ReviewItem> {
  const [row] = await db
    .update(reviewItems)
    .set({ status: resolution, resolvedAt: new Date() })
    .where(eq(reviewItems.id, id))
    .returning();
  if (!row) throw new NotFoundError('ReviewItem', id);
  return row;
}
