import {
  pgTable,
  uuid,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { applications } from './applications.js';
import { applicationEventTypeEnum, applicationStatusEnum } from './enums.js';

/**
 * Append-only audit history for an application. These rows are historical facts:
 * normal application logic must NEVER UPDATE or DELETE them. The repository layer
 * exposes insert + read only (no mutation API).
 *
 * Only `created_at` is needed (no updated_at) because rows are immutable. Ordering
 * uses (created_at, id) so events created within the same transaction still have a
 * deterministic order.
 */
export const applicationEvents = pgTable(
  'application_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    eventType: applicationEventTypeEnum('event_type').notNull(),
    fromStatus: applicationStatusEnum('from_status'),
    toStatus: applicationStatusEnum('to_status'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('application_events_application_id_idx').on(t.applicationId),
    index('application_events_app_created_idx').on(t.applicationId, t.createdAt),
  ],
);

export type ApplicationEvent = typeof applicationEvents.$inferSelect;
export type NewApplicationEvent = typeof applicationEvents.$inferInsert;
