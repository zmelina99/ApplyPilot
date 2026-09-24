import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { jobs } from './jobs.js';
import { matchStatusEnum, eligibilityStatusEnum, fitStatusEnum } from './enums.js';

/**
 * Evaluation of ONE job for ONE user. This is where user-specific eligibility and
 * fit live — never on the global `jobs` row.
 *
 * `status` is the match lifecycle (PENDING → FILTERED/QUALIFIED/REJECTED), kept
 * distinct from application execution state. `eligibility_status` (hard rules) and
 * `fit_status`/`fit_score` (soft scoring) are separate, matching the Phase 1
 * HARD-ELIGIBILITY-vs-SKILL-FIT rule.
 *
 * UNIQUE (user_id, job_id): a user has at most one current match per job.
 */
export const jobMatches = pgTable(
  'job_matches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    status: matchStatusEnum('status').default('PENDING').notNull(),
    eligibilityStatus: eligibilityStatusEnum('eligibility_status')
      .default('PENDING')
      .notNull(),
    eligibilityReason: text('eligibility_reason'),
    fitStatus: fitStatusEnum('fit_status').default('PENDING').notNull(),
    // Integer 0-100 fit score; NULL until evaluated. Avoids float ambiguity.
    fitScore: integer('fit_score'),
    fitReason: text('fit_reason'),
    // Structured deterministic-eligibility output (reason codes, priority flag).
    // Human-readable summary stays in `eligibility_reason`; core queryable fields
    // (status, eligibility_status) remain columns — not buried in JSON.
    evaluationDetails: jsonb('evaluation_details'),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }),
    evaluationVersion: text('evaluation_version'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('job_matches_user_job_unique').on(t.userId, t.jobId),
    index('job_matches_user_id_idx').on(t.userId),
    index('job_matches_job_id_idx').on(t.jobId),
  ],
);

export type JobMatch = typeof jobMatches.$inferSelect;
export type NewJobMatch = typeof jobMatches.$inferInsert;
