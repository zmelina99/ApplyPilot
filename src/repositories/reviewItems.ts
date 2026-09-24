import { and, eq, desc, inArray } from 'drizzle-orm';
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
  /** Content hash of the job at review time; lets us detect material change later. */
  contentHash?: string | null;
}

export async function createReviewItem(
  exec: Exec,
  input: CreateReviewInput,
): Promise<ReviewItem> {
  const payload = {
    ...(typeof input.payload === 'object' && input.payload ? input.payload : {}),
    ...(input.contentHash ? { contentHash: input.contentHash } : {}),
  };
  const [row] = await exec
    .insert(reviewItems)
    .values({
      userId: input.userId,
      reviewType: input.reviewType,
      jobId: input.jobId ?? null,
      applicationId: input.applicationId ?? null,
      reason: input.reason ?? null,
      payload: (Object.keys(payload).length ? payload : null) as NewReviewItem['payload'],
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
 * Find the most recent review item for (user, job, reviewType) in ANY status. Used
 * so that a human's resolution is not silently recreated on the next run.
 */
export async function findExistingReviewForJob(
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
      ),
    )
    .orderBy(desc(reviewItems.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Create a review item only if no prior one exists for this (user, job, type) — in
 * ANY status, so human decisions persist across runs. The one exception: if a prior
 * review was resolved/dismissed but the job content has MATERIALLY CHANGED (its hash
 * differs), a fresh review is created noting the change rather than silently keeping
 * the stale human decision.
 */
export async function createReviewIfAbsent(
  db: Database,
  input: CreateReviewInput,
): Promise<{ created: boolean; item: ReviewItem; reason?: 'exists' | 'content_changed' }> {
  if (input.jobId) {
    const existing = await findExistingReviewForJob(
      db,
      input.userId,
      input.jobId,
      input.reviewType,
    );
    if (existing) {
      const prevHash = (existing.payload as { contentHash?: string } | null)?.contentHash;
      const changed =
        existing.status !== 'OPEN' &&
        input.contentHash != null &&
        prevHash != null &&
        prevHash !== input.contentHash;
      if (!changed) return { created: false, item: existing, reason: 'exists' };
      const item = await createReviewItem(db, {
        ...input,
        reason: `${input.reason ?? ''} (job content changed since prior review)`.trim(),
      });
      return { created: true, item, reason: 'content_changed' };
    }
  }
  const item = await createReviewItem(db, input);
  return { created: true, item };
}

/** Dismiss all OPEN review items of the given types for a user (bulk cleanup). */
export async function dismissReviewsByTypes(
  db: Database,
  userId: string,
  types: NewReviewItem['reviewType'][],
  note: string,
): Promise<number> {
  if (types.length === 0) return 0;
  const rows = await db
    .update(reviewItems)
    .set({ status: 'DISMISSED', resolvedAt: new Date(), reason: note })
    .where(
      and(
        eq(reviewItems.userId, userId),
        eq(reviewItems.status, 'OPEN'),
        inArray(reviewItems.reviewType, types),
      ),
    )
    .returning();
  return rows.length;
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

/** Record a human decision on a review item, optionally with a short note. */
export async function resolveReviewItem(
  db: Database,
  id: string,
  resolution: ReviewResolution = 'RESOLVED',
  note?: string | null,
): Promise<ReviewItem> {
  const existing = await getReviewItem(db, id);
  if (!existing) throw new NotFoundError('ReviewItem', id);
  const payload = {
    ...(typeof existing.payload === 'object' && existing.payload ? existing.payload : {}),
    ...(note ? { humanNote: note, decidedAt: new Date().toISOString() } : {}),
  };
  const [row] = await db
    .update(reviewItems)
    .set({
      status: resolution,
      resolvedAt: new Date(),
      payload: payload as NewReviewItem['payload'],
    })
    .where(eq(reviewItems.id, id))
    .returning();
  if (!row) throw new NotFoundError('ReviewItem', id);
  return row;
}
