import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import { usersRepo, jobsRepo, applicationsRepo, eventsRepo } from '../src/repositories/index.js';
import * as eventsModule from '../src/repositories/applicationEvents.js';

async function fixture(handle: DbHandle) {
  const user = await usersRepo.createUser(handle.db);
  const job = await jobsRepo.upsertJob(handle.db, {
    canonicalUrl: `https://jobs.example/e/${crypto.randomUUID()}`,
  });
  const app = await applicationsRepo.createApplication(handle.db, user.id, job.id);
  return { user, job, app };
}

describe('application events (append-only audit)', () => {
  let handle: DbHandle;
  beforeAll(async () => {
    handle = await openTestDb();
  });
  afterAll(async () => {
    await handle.close();
  });
  beforeEach(async () => {
    await resetDb(handle.db);
  });

  it('creates APPLICATION_CREATED on creation', async () => {
    const { app } = await fixture(handle);
    const history = await eventsRepo.getApplicationHistory(handle.db, app.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.eventType).toBe('APPLICATION_CREATED');
  });

  it('creates exactly one STATUS_CHANGED event per transition, in order', async () => {
    const { app } = await fixture(handle);
    await applicationsRepo.transitionStatus(handle.db, app.id, 'APPLYING');
    await applicationsRepo.transitionStatus(handle.db, app.id, 'READY_FOR_APPROVAL');
    await applicationsRepo.transitionStatus(handle.db, app.id, 'APPLIED');

    const history = await eventsRepo.getApplicationHistory(handle.db, app.id);
    const types = history.map((e) => e.eventType);
    expect(types).toEqual([
      'APPLICATION_CREATED',
      'STATUS_CHANGED',
      'STATUS_CHANGED',
      'STATUS_CHANGED',
    ]);
    // Transition events carry from/to and are ordered oldest-first.
    expect(history[1]?.fromStatus).toBe('QUEUED');
    expect(history[1]?.toStatus).toBe('APPLYING');
    expect(history[3]?.toStatus).toBe('APPLIED');
  });

  it('is atomic: a failed transition writes neither status nor event', async () => {
    const { app } = await fixture(handle);
    const before = await eventsRepo.getApplicationHistory(handle.db, app.id);
    await expect(
      applicationsRepo.transitionStatus(handle.db, app.id, 'APPLIED'), // invalid from QUEUED
    ).rejects.toThrow();
    const after = await eventsRepo.getApplicationHistory(handle.db, app.id);
    expect(after).toHaveLength(before.length); // no new event
    const reread = await applicationsRepo.getApplication(handle.db, app.id);
    expect(reread?.status).toBe('QUEUED'); // status unchanged
  });

  it('exposes no mutation operations on the events repository', () => {
    // The append-only contract: insert + read only, no update/delete.
    expect(
      (eventsModule as Record<string, unknown>).updateEvent,
    ).toBeUndefined();
    expect(
      (eventsModule as Record<string, unknown>).deleteEvent,
    ).toBeUndefined();
    const exported = Object.keys(eventsModule).sort();
    expect(exported).toEqual(['getApplicationHistory', 'recordEvent']);
  });
});
