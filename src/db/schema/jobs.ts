import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import {
  remoteTypeEnum,
  employmentTypeEnum,
  salaryPeriodEnum,
  postingStatusEnum,
} from './enums.js';

/**
 * A normalized external job posting. GLOBAL and user-agnostic: the same job row is
 * shared across all users. It must NOT carry any user-specific state (fit,
 * eligibility, application status, review state) — those live on job_matches /
 * applications / review_items.
 *
 * Missing source data stays NULL and is never invented. Salary is stored as
 * `numeric` (arbitrary precision) to avoid floating-point money errors; the value
 * surfaces as a string in TypeScript.
 */
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Normalized canonical URL — the global identity of a posting for dedup.
    canonicalUrl: text('canonical_url').notNull(),
    companyName: text('company_name'),
    title: text('title'),
    locationText: text('location_text'),
    remoteType: remoteTypeEnum('remote_type').default('UNKNOWN').notNull(),
    employmentType: employmentTypeEnum('employment_type'),
    description: text('description'),
    salaryMin: numeric('salary_min'),
    salaryMax: numeric('salary_max'),
    salaryCurrency: text('salary_currency'),
    salaryPeriod: salaryPeriodEnum('salary_period'),
    datePosted: timestamp('date_posted', { withTimezone: true }),
    firstDiscoveredAt: timestamp('first_discovered_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    postingStatus: postingStatusEnum('posting_status').default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('jobs_canonical_url_unique').on(t.canonicalUrl)],
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
