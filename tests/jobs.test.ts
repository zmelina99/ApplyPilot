import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DbHandle } from '../src/db/client.js';
import { openTestDb, resetDb } from './helpers/db.js';
import { jobsRepo, jobSourcesRepo } from '../src/repositories/index.js';

describe('jobs & sources', () => {
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

  it('creates a job', async () => {
    const job = await jobsRepo.upsertJob(handle.db, {
      canonicalUrl: 'https://jobs.example/openings/fe-1',
      companyName: 'Example Co',
      title: 'Frontend Engineer',
      salaryMin: '60000',
      salaryCurrency: 'EUR',
      salaryPeriod: 'YEAR',
    });
    expect(job.id).toBeTruthy();
    expect(job.companyName).toBe('Example Co');
    // numeric returns as string — no float corruption.
    expect(job.salaryMin).toBe('60000');
  });

  it('dedupes jobs by normalized canonical URL', async () => {
    const a = await jobsRepo.upsertJob(handle.db, {
      canonicalUrl: 'https://jobs.example/openings/fe-1?utm_source=x',
      title: 'Frontend Engineer',
    });
    const b = await jobsRepo.upsertJob(handle.db, {
      canonicalUrl: 'https://jobs.example/openings/fe-1/',
      companyName: 'Filled Later',
    });
    expect(b.id).toBe(a.id); // same normalized URL → same global job
    expect(b.companyName).toBe('Filled Later'); // fills, does not duplicate

    const all = await jobsRepo.listJobs(handle.db);
    expect(all).toHaveLength(1);
  });

  it('handles duplicate source ingestion idempotently', async () => {
    const job = await jobsRepo.upsertJob(handle.db, {
      canonicalUrl: 'https://jobs.example/openings/fe-2',
    });
    const s1 = await jobSourcesRepo.attachSource(handle.db, {
      jobId: job.id,
      sourceName: 'board-x',
      sourceJobId: 'x-123',
      sourceUrl: 'https://board-x.example/j/x-123',
    });
    const s2 = await jobSourcesRepo.attachSource(handle.db, {
      jobId: job.id,
      sourceName: 'board-x',
      sourceJobId: 'x-123',
      sourceUrl: 'https://board-x.example/j/x-123',
    });
    expect(s2.id).toBe(s1.id);
    const sources = await jobSourcesRepo.listSourcesForJob(handle.db, job.id);
    expect(sources).toHaveLength(1);
  });

  it('dedupes sources by (name,url) even when source_job_id is null', async () => {
    const job = await jobsRepo.upsertJob(handle.db, {
      canonicalUrl: 'https://jobs.example/openings/fe-3',
    });
    await jobSourcesRepo.attachSource(handle.db, {
      jobId: job.id,
      sourceName: 'board-y',
      sourceUrl: 'https://board-y.example/j/abc',
    });
    await jobSourcesRepo.attachSource(handle.db, {
      jobId: job.id,
      sourceName: 'board-y',
      sourceUrl: 'https://board-y.example/j/abc',
    });
    const sources = await jobSourcesRepo.listSourcesForJob(handle.db, job.id);
    expect(sources).toHaveLength(1);
  });
});
