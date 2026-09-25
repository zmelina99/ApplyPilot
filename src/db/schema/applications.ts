import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { jobs } from './jobs.js';
import { applicationStatusEnum, applicationProviderEnum } from './enums.js';

/**
 * ONE user applying to ONE job. Execution state only (QUEUED → … → APPLIED).
 *
 * UNIQUE (user_id, job_id): critical duplicate-submission protection — a user can
 * never accidentally create two applications for the same job. Combined with the
 * APPLIED-is-terminal rule in the state machine, this prevents double submission.
 */
export const applications = pgTable(
  'applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    status: applicationStatusEnum('status').default('QUEUED').notNull(),
    atsType: text('ats_type'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').default(0).notNull(),
    currentStep: text('current_step'),
    requiresUserInput: boolean('requires_user_input').default(false).notNull(),
    userInputReason: text('user_input_reason'),
    failureCategory: text('failure_category'),
    failureDetails: text('failure_details'),
    // Phase 2D — supervised preparation:
    provider: applicationProviderEnum('provider'),
    applyUrl: text('apply_url'), // resolved external application URL (or aggregator page)
    formUnderstood: boolean('form_understood').default(false).notNull(),
    resumeStatus: text('resume_status'), // READY | MISSING
    preparationNote: text('preparation_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('applications_user_job_unique').on(t.userId, t.jobId),
    index('applications_user_id_idx').on(t.userId),
    index('applications_job_id_idx').on(t.jobId),
    index('applications_status_idx').on(t.status),
  ],
);

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
