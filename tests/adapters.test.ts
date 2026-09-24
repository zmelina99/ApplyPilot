import { describe, it, expect } from 'vitest';
import { normalizeRemotive } from '../src/sources/remotive.js';
import { normalizeArbeitnow } from '../src/sources/arbeitnow.js';
import { normalizeJobicy } from '../src/sources/jobicy.js';

describe('adapter normalization (fixtures, no network)', () => {
  it('normalizes a Remotive job', () => {
    const c = normalizeRemotive({
      id: 123,
      url: 'https://remotive.com/remote-jobs/software-dev/frontend-engineer-123',
      title: 'Frontend Engineer',
      company_name: 'Acme',
      candidate_required_location: 'Europe',
      job_type: 'full_time',
      publication_date: '2026-09-20T10:00:00',
      salary: '$50k-70k',
      description: '<p>React &amp; TypeScript</p>',
      tags: ['react'],
    });
    expect(c.sourceName).toBe('remotive');
    expect(c.sourceJobId).toBe('123');
    expect(c.remoteType).toBe('REMOTE');
    expect(c.employmentType).toBe('PERMANENT');
    expect(c.locationText).toBe('Europe');
    // Free-text salary is NOT parsed into numbers.
    expect(c.salaryMin).toBeNull();
    expect(c.salaryMax).toBeNull();
    // No-timezone date treated as UTC.
    expect(c.datePosted?.toISOString()).toBe('2026-09-20T10:00:00.000Z');
  });

  it('normalizes an Arbeitnow remote vs on-site job', () => {
    const remote = normalizeArbeitnow({
      slug: 'fe-1',
      company_name: 'Beta',
      title: 'Frontend Developer',
      description: 'React',
      remote: true,
      url: 'https://www.arbeitnow.com/jobs/beta/fe-1',
      job_types: ['full_time'],
      location: 'Berlin',
      created_at: 1_758_000_000,
    });
    expect(remote.remoteType).toBe('REMOTE');
    expect(remote.employmentType).toBe('PERMANENT');
    expect(remote.datePosted).toBeInstanceOf(Date);

    const onsite = normalizeArbeitnow({
      slug: 'fe-2',
      company_name: 'Beta',
      title: 'Frontend Developer',
      remote: false,
      url: 'https://www.arbeitnow.com/jobs/beta/fe-2',
      location: 'Munich',
    });
    expect(onsite.remoteType).toBe('ONSITE');
    expect(onsite.datePosted).toBeNull();
  });

  it('normalizes a Jobicy job with and without salary', () => {
    const withSalary = normalizeJobicy({
      id: 151496,
      url: 'https://jobicy.com/jobs/x',
      jobTitle: 'React Engineer',
      companyName: 'Gamma',
      jobGeo: 'Anywhere',
      jobType: ['Full-Time'],
      jobLevel: 'Senior',
      jobDescription: 'React',
      pubDate: '2026-09-24T04:40:19+00:00',
      annualSalaryMin: 60000,
      annualSalaryMax: 80000,
      salaryCurrency: 'USD',
    });
    expect(withSalary.remoteType).toBe('REMOTE');
    expect(withSalary.locationText).toBe('Anywhere');
    expect(withSalary.salaryMin).toBe('60000');
    expect(withSalary.salaryCurrency).toBe('USD');
    expect(withSalary.salaryPeriod).toBe('YEAR');

    const noSalary = normalizeJobicy({
      id: 2,
      url: 'https://jobicy.com/jobs/y',
      jobTitle: 'Frontend Engineer',
      companyName: 'Delta',
      jobGeo: 'Europe',
      jobType: ['Full-Time'],
    });
    expect(noSalary.salaryMin).toBeNull();
    expect(noSalary.salaryCurrency).toBeNull();
    expect(noSalary.salaryPeriod).toBeNull();
  });
});
