import { and, eq, desc, sql } from 'drizzle-orm';
import type { Database, Exec } from '../db/client.js';
import { applications } from '../db/schema/index.js';
import type { Application } from '../db/schema/applications.js';
import { recordEvent } from './applicationEvents.js';
import { canTransition, INITIAL_STATUS } from '../domain/applicationStateMachine.js';
import type { ApplicationStatus } from '../domain/applicationStateMachine.js';
import { InvalidTransitionError, NotFoundError } from '../domain/errors.js';

/**
 * Create an application for (user, job). Fails if one already exists — the DB unique
 * constraint on (user_id, job_id) is the real guard; this is the critical
 * duplicate-submission protection. Creation and its APPLICATION_CREATED event are
 * written in one transaction.
 */
export async function createApplication(
  db: Database,
  userId: string,
  jobId: string,
): Promise<Application> {
  return db.transaction(async (tx) => {
    const [app] = await tx
      .insert(applications)
      .values({ userId, jobId, status: INITIAL_STATUS })
      .returning();
    if (!app) throw new Error('Failed to create application');
    await recordEvent(tx, {
      applicationId: app.id,
      eventType: 'APPLICATION_CREATED',
      toStatus: app.status,
    });
    return app;
  });
}

export async function getApplication(
  exec: Exec,
  id: string,
): Promise<Application | null> {
  const [row] = await exec
    .select()
    .from(applications)
    .where(eq(applications.id, id))
    .limit(1);
  return row ?? null;
}

export async function getApplicationForUserJob(
  exec: Exec,
  userId: string,
  jobId: string,
): Promise<Application | null> {
  const [row] = await exec
    .select()
    .from(applications)
    .where(and(eq(applications.userId, userId), eq(applications.jobId, jobId)))
    .limit(1);
  return row ?? null;
}

export async function listApplicationsForUser(
  exec: Exec,
  userId: string,
  limit = 100,
): Promise<Application[]> {
  return exec
    .select()
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.createdAt))
    .limit(limit);
}

/**
 * Atomically increment attempt_count and stamp last_attempt_at. Uses an in-SQL
 * increment (attempt_count + 1) rather than read-modify-write, so it is safe under
 * concurrency.
 */
export async function incrementAttemptCount(
  db: Database,
  applicationId: string,
): Promise<Application> {
  const [row] = await db
    .update(applications)
    .set({
      attemptCount: sql`${applications.attemptCount} + 1`,
      lastAttemptAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(applications.id, applicationId))
    .returning();
  if (!row) throw new NotFoundError('Application', applicationId);
  return row;
}

/** Optional side-effects to apply alongside a status transition. */
export interface TransitionOptions {
  /** Extra metadata stored on the emitted STATUS_CHANGED event (JSONB). */
  metadata?: unknown;
  currentStep?: string | null;
  atsType?: string | null;
  requiresUserInput?: boolean;
  userInputReason?: string | null;
  failureCategory?: string | null;
  failureDetails?: string | null;
}

/**
 * Transition an application to `toStatus`, validating against the domain state
 * machine and writing the status change AND its audit event in ONE transaction.
 *
 * Guarantees:
 *  - The row is locked (SELECT … FOR UPDATE) so concurrent transitions serialize.
 *  - An invalid transition (including any move out of terminal APPLIED) throws
 *    BEFORE any write — no partial state.
 *  - It is impossible to persist the new status without the corresponding event:
 *    both happen in the same transaction or neither does.
 */
export async function transitionStatus(
  db: Database,
  applicationId: string,
  toStatus: ApplicationStatus,
  options: TransitionOptions = {},
): Promise<Application> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(applications)
      .where(eq(applications.id, applicationId))
      .limit(1)
      .for('update');
    if (!current) throw new NotFoundError('Application', applicationId);

    const from = current.status;
    if (!canTransition(from, toStatus)) {
      // Rolls back the transaction — no writes occur.
      throw new InvalidTransitionError(from, toStatus);
    }

    const now = new Date();
    const patch: Partial<typeof applications.$inferInsert> = {
      status: toStatus,
      updatedAt: now,
    };
    if (toStatus === 'APPLYING' && !current.startedAt) patch.startedAt = now;
    if (toStatus === 'APPLIED') patch.submittedAt = now;
    if (options.currentStep !== undefined) patch.currentStep = options.currentStep;
    if (options.atsType !== undefined) patch.atsType = options.atsType;
    if (options.requiresUserInput !== undefined)
      patch.requiresUserInput = options.requiresUserInput;
    if (options.userInputReason !== undefined)
      patch.userInputReason = options.userInputReason;
    if (options.failureCategory !== undefined)
      patch.failureCategory = options.failureCategory;
    if (options.failureDetails !== undefined)
      patch.failureDetails = options.failureDetails;

    const [updated] = await tx
      .update(applications)
      .set(patch)
      .where(eq(applications.id, applicationId))
      .returning();
    if (!updated) throw new NotFoundError('Application', applicationId);

    await recordEvent(tx, {
      applicationId,
      eventType: 'STATUS_CHANGED',
      fromStatus: from,
      toStatus,
      metadata: options.metadata ?? null,
    });

    return updated;
  });
}
