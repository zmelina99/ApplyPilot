import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { jobs } from './jobs.js';

/**
 * Where a normalized job was discovered. One job may appear via multiple sources.
 *
 * Duplicate-ingestion protection:
 *  - When a stable source_job_id exists: unique per (source_name, source_job_id)
 *    via a PARTIAL index (NULLs excluded, since many NULLs would otherwise collide
 *    trivially but are not real duplicates).
 *  - Always: unique per (source_name, source_url) — covers the case where the
 *    source provides no id, using the URL as the per-source identity.
 *
 * `raw_payload` (JSONB) keeps flexible source-specific metadata; it must NOT be used
 * to hold core queryable fields that belong on `jobs`.
 */
export const jobSources = pgTable(
  'job_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    sourceName: text('source_name').notNull(),
    sourceJobId: text('source_job_id'),
    sourceUrl: text('source_url').notNull(),
    discoveredAt: timestamp('discovered_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    rawPayload: jsonb('raw_payload'),
  },
  (t) => [
    uniqueIndex('job_sources_name_source_job_id_unique')
      .on(t.sourceName, t.sourceJobId)
      .where(sql`${t.sourceJobId} IS NOT NULL`),
    uniqueIndex('job_sources_name_url_unique').on(t.sourceName, t.sourceUrl),
    index('job_sources_job_id_idx').on(t.jobId),
  ],
);

export type JobSource = typeof jobSources.$inferSelect;
export type NewJobSource = typeof jobSources.$inferInsert;
