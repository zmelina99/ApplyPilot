import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { jobs } from './jobs.js';
import { applications } from './applications.js';
import { reviewTypeEnum, reviewStatusEnum } from './enums.js';

/**
 * Persistent human-attention queue. Ownership is always explicit via `user_id`.
 * `job_id` / `application_id` are optional links depending on review type.
 *
 * `payload` (JSONB) holds review-type-specific context; core queryable fields
 * (user, status, type) remain proper columns.
 */
export const reviewItems = pgTable(
  'review_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id').references(() => applications.id, {
      onDelete: 'cascade',
    }),
    reviewType: reviewTypeEnum('review_type').notNull(),
    status: reviewStatusEnum('status').default('OPEN').notNull(),
    reason: text('reason'),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    index('review_items_user_id_idx').on(t.userId),
    index('review_items_user_status_idx').on(t.userId, t.status),
    index('review_items_application_id_idx').on(t.applicationId),
  ],
);

export type ReviewItem = typeof reviewItems.$inferSelect;
export type NewReviewItem = typeof reviewItems.$inferInsert;
