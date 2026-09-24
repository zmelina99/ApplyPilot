import { eq, sql } from 'drizzle-orm';
import type { Database, Exec } from '../db/client.js';
import { userAutomationSettings } from '../db/schema/index.js';
import type { UserAutomationSettings } from '../db/schema/userAutomationSettings.js';
import { NotFoundError } from '../domain/errors.js';

export async function getSettings(
  exec: Exec,
  userId: string,
): Promise<UserAutomationSettings | null> {
  const [row] = await exec
    .select()
    .from(userAutomationSettings)
    .where(eq(userAutomationSettings.userId, userId))
    .limit(1);
  return row ?? null;
}

/** Fields a caller may safely update. Note: `automationEnabled` is intentionally
 * NOT settable here — it can only be turned on via `approveAutomation`. */
export interface UpdatableSettings {
  initialReviewTarget?: number;
}

export async function updateSettings(
  db: Database,
  userId: string,
  patch: UpdatableSettings,
): Promise<UserAutomationSettings> {
  const [row] = await db
    .update(userAutomationSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(userAutomationSettings.userId, userId))
    .returning();
  if (!row) throw new NotFoundError('UserAutomationSettings', userId);
  return row;
}

/**
 * Atomically increment the reviewed-application count. If the count reaches the
 * target AND approval has not yet been requested, move the approval status to
 * AWAITING_AUTOMATION_APPROVAL.
 *
 * CRITICAL INVARIANT: this NEVER sets automationEnabled = true. Reaching the target
 * only gates on the user's explicit decision.
 */
export async function incrementReviewedCount(
  db: Database,
  userId: string,
): Promise<UserAutomationSettings> {
  return db.transaction(async (tx) => {
    // Atomic SQL increment (no read-modify-write race).
    const [row] = await tx
      .update(userAutomationSettings)
      .set({
        initialReviewCount: sql`${userAutomationSettings.initialReviewCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(userAutomationSettings.userId, userId))
      .returning();
    if (!row) throw new NotFoundError('UserAutomationSettings', userId);

    if (
      row.initialReviewCount >= row.initialReviewTarget &&
      row.automationApprovalStatus === 'NOT_REQUESTED'
    ) {
      const [updated] = await tx
        .update(userAutomationSettings)
        .set({
          automationApprovalStatus: 'AWAITING_AUTOMATION_APPROVAL',
          updatedAt: new Date(),
        })
        .where(eq(userAutomationSettings.userId, userId))
        .returning();
      // automationEnabled deliberately untouched — stays false.
      return updated ?? row;
    }
    return row;
  });
}

/** Explicit user authorization: the ONLY path that enables automation. */
export async function approveAutomation(
  db: Database,
  userId: string,
): Promise<UserAutomationSettings> {
  const [row] = await db
    .update(userAutomationSettings)
    .set({
      automationApprovalStatus: 'APPROVED',
      automationEnabled: true,
      updatedAt: new Date(),
    })
    .where(eq(userAutomationSettings.userId, userId))
    .returning();
  if (!row) throw new NotFoundError('UserAutomationSettings', userId);
  return row;
}

/** Explicit user decline: records the decision; automation stays disabled. */
export async function declineAutomation(
  db: Database,
  userId: string,
): Promise<UserAutomationSettings> {
  const [row] = await db
    .update(userAutomationSettings)
    .set({
      automationApprovalStatus: 'DECLINED',
      automationEnabled: false,
      updatedAt: new Date(),
    })
    .where(eq(userAutomationSettings.userId, userId))
    .returning();
  if (!row) throw new NotFoundError('UserAutomationSettings', userId);
  return row;
}
