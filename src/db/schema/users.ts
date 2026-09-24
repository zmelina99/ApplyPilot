import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * An ApplyPilot user. Jobs are global; everything user-specific (matches,
 * applications, reviews, automation settings) hangs off this table.
 *
 * V1 seeds exactly one local user. No authentication, no sensitive PII here —
 * contact/application details stay in the gitignored .env privacy model.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
