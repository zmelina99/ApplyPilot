import { pgTable, uuid, boolean, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { automationApprovalStatusEnum } from './enums.js';

/**
 * One row per user. Governs the human-review safety period and whether autonomous
 * submission is enabled.
 *
 * INVARIANT: reaching `initialReviewTarget` reviewed applications must NEVER set
 * `automationEnabled = true`. It may only move `automationApprovalStatus` to
 * AWAITING_AUTOMATION_APPROVAL. Only an explicit user action enables automation.
 */
export const userAutomationSettings = pgTable('user_automation_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  automationEnabled: boolean('automation_enabled').default(false).notNull(),
  initialReviewTarget: integer('initial_review_target').default(20).notNull(),
  initialReviewCount: integer('initial_review_count').default(0).notNull(),
  automationApprovalStatus: automationApprovalStatusEnum('automation_approval_status')
    .default('NOT_REQUESTED')
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type UserAutomationSettings = typeof userAutomationSettings.$inferSelect;
export type NewUserAutomationSettings = typeof userAutomationSettings.$inferInsert;
