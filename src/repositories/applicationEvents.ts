import { asc, eq } from 'drizzle-orm';
import type { Exec } from '../db/client.js';
import { applicationEvents } from '../db/schema/index.js';
import type {
  ApplicationEvent,
  NewApplicationEvent,
} from '../db/schema/applicationEvents.js';

/**
 * Append-only audit repository. By design it exposes ONLY insert + read — there is
 * deliberately no update or delete operation. Events are historical facts.
 *
 * `recordEvent` accepts an `Exec` so it can (and must, for status changes) run
 * inside the same transaction as the state change it records.
 */
export interface RecordEventInput {
  applicationId: string;
  eventType: NewApplicationEvent['eventType'];
  fromStatus?: NewApplicationEvent['fromStatus'];
  toStatus?: NewApplicationEvent['toStatus'];
  metadata?: unknown;
}

export async function recordEvent(
  exec: Exec,
  input: RecordEventInput,
): Promise<ApplicationEvent> {
  const [row] = await exec
    .insert(applicationEvents)
    .values({
      applicationId: input.applicationId,
      eventType: input.eventType,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      metadata: (input.metadata ?? null) as NewApplicationEvent['metadata'],
    })
    .returning();
  if (!row) throw new Error('Failed to record application event');
  return row;
}

/** Full event history for an application, oldest first. */
export async function getApplicationHistory(
  exec: Exec,
  applicationId: string,
): Promise<ApplicationEvent[]> {
  return exec
    .select()
    .from(applicationEvents)
    .where(eq(applicationEvents.applicationId, applicationId))
    .orderBy(asc(applicationEvents.createdAt), asc(applicationEvents.id));
}
