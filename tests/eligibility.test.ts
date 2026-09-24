import { describe, it, expect } from 'vitest';
import { loadSearchConfig } from '../src/config/searchConfig.js';
import { evaluateEligibility } from '../src/eligibility/engine.js';
import type { EvaluableJob } from '../src/eligibility/types.js';

const cfg = loadSearchConfig();
const NOW = new Date('2026-09-24T12:00:00Z');

function job(p: Partial<EvaluableJob>): EvaluableJob {
  return {
    title: 'Frontend Engineer',
    description: 'Build UIs with React and TypeScript.',
    locationText: 'Europe',
    remoteType: 'REMOTE',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    datePosted: new Date('2026-09-23T12:00:00Z'),
    ...p,
  };
}

const codes = (j: EvaluableJob) => evaluateEligibility(j, cfg, NOW).reasons.map((r) => r.code);
const status = (j: EvaluableJob) => evaluateEligibility(j, cfg, NOW).status;

describe('deterministic eligibility engine', () => {
  it('qualifies an eligible European remote role', () => {
    expect(status(job({}))).toBe('ELIGIBLE');
  });

  it('qualifies Valencia hybrid', () => {
    expect(status(job({ remoteType: 'HYBRID', locationText: 'Valencia, Spain' }))).toBe('ELIGIBLE');
  });

  it('qualifies a Swiss on-site role', () => {
    expect(status(job({ remoteType: 'ONSITE', locationText: 'Zürich, Switzerland' }))).toBe('ELIGIBLE');
  });

  it('rejects a US-resident-only role', () => {
    const j = job({
      locationText: 'United States',
      description: 'You must reside in the US and have US work authorization.',
    });
    expect(status(j)).toBe('INELIGIBLE');
    expect(codes(j)).toContain('LOCAL_WORK_AUTH_REQUIRED');
  });

  it('does NOT reject an internationally-hireable US company', () => {
    expect(status(job({ locationText: 'Worldwide', description: 'US startup, hire anywhere.' }))).toBe('ELIGIBLE');
  });

  it('rejects a UK local-authorization-only role', () => {
    const j = job({
      locationText: 'United Kingdom',
      description: 'You must have the right to work in the UK.',
    });
    expect(status(j)).toBe('INELIGIBLE');
    expect(codes(j)).toContain('LOCAL_WORK_AUTH_REQUIRED');
  });

  it('marks ambiguous international eligibility as NEEDS_REVIEW', () => {
    const j = job({ locationText: 'United States', description: 'Great remote role.' });
    expect(status(j)).toBe('NEEDS_REVIEW');
    expect(codes(j)).toContain('INTERNATIONAL_HIRING_AMBIGUOUS');
  });

  it('rejects salary below the EUR floor', () => {
    const j = job({ salaryMax: '40000', salaryCurrency: 'EUR', salaryPeriod: 'YEAR' });
    expect(status(j)).toBe('INELIGIBLE');
    expect(codes(j)).toContain('SALARY_BELOW_FLOOR');
  });

  it('rejects Swiss salary below the CHF floor', () => {
    const j = job({
      remoteType: 'ONSITE',
      locationText: 'Zürich, Switzerland',
      salaryMax: '80000',
      salaryCurrency: 'CHF',
      salaryPeriod: 'YEAR',
    });
    expect(status(j)).toBe('INELIGIBLE');
    expect(codes(j)).toContain('SALARY_BELOW_FLOOR');
  });

  it('does not reject for missing salary', () => {
    expect(status(job({ salaryMin: null, salaryMax: null }))).toBe('ELIGIBLE');
  });

  it('does not reject a foreign-currency salary (not guessed/converted)', () => {
    expect(
      status(job({ salaryMax: '90000', salaryCurrency: 'USD', salaryPeriod: 'YEAR', locationText: 'Worldwide' })),
    ).toBe('ELIGIBLE');
  });

  it('does not reject solely for a 5+ years requirement', () => {
    expect(status(job({ description: 'We require 5+ years of React experience.' }))).toBe('ELIGIBLE');
  });

  it('rejects an obvious junior role', () => {
    const j = job({ title: 'Junior Frontend Developer' });
    expect(status(j)).toBe('INELIGIBLE');
    expect(codes(j)).toContain('JUNIOR_ROLE');
  });

  it('rejects an out-of-scope backend role', () => {
    const j = job({ title: 'Backend Engineer', description: 'Go and Postgres.' });
    expect(status(j)).toBe('INELIGIBLE');
    expect(codes(j)).toContain('ROLE_OUT_OF_SCOPE');
  });

  it('routes Staff roles to review (no auto-qualify)', () => {
    expect(status(job({ title: 'Staff Frontend Engineer' }))).toBe('NEEDS_REVIEW');
  });

  it('rejects a job older than 14 days', () => {
    const j = job({ datePosted: new Date('2026-09-01T12:00:00Z') });
    expect(status(j)).toBe('INELIGIBLE');
    expect(codes(j)).toContain('TOO_OLD');
  });

  it('does not reject solely for a missing posting date', () => {
    expect(status(job({ datePosted: null }))).toBe('ELIGIBLE');
  });

  it('flags priority for jobs posted within 72h', () => {
    const fresh = evaluateEligibility(job({ datePosted: new Date('2026-09-24T00:00:00Z') }), cfg, NOW);
    const stale = evaluateEligibility(job({ datePosted: new Date('2026-09-18T00:00:00Z') }), cfg, NOW);
    expect(fresh.priority).toBe(true);
    expect(stale.priority).toBe(false);
  });
});
