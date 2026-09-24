import { describe, it, expect } from 'vitest';
import { loadCandidateFacts } from '../src/config/candidateFacts.js';
import { buildCandidateAnalysis } from '../src/analysis/candidateAnalysis.js';
import { FakeFitAnalyzer } from '../src/analysis/fakeAnalyzer.js';
import { assembleFitAnalysis } from '../src/analysis/assemble.js';
import { computeFitScore, fitStatusForScore, modelFitOutputSchema } from '../src/analysis/schema.js';
import { analysisHash } from '../src/analysis/jobContent.js';
import type { JobAnalysisInput } from '../src/analysis/types.js';

const candidate = buildCandidateAnalysis(loadCandidateFacts());
const analyzer = new FakeFitAnalyzer();

function job(p: Partial<JobAnalysisInput>): JobAnalysisInput {
  return {
    title: 'Frontend Engineer',
    company: 'ExampleCo',
    location: 'Remote — Europe',
    remoteType: 'REMOTE',
    employmentType: 'PERMANENT',
    salary: null,
    description: 'Build UIs with React and TypeScript. Own frontend architecture and features.',
    ...p,
  };
}

async function score(p: Partial<JobAnalysisInput>): Promise<number> {
  const { output } = await analyzer.analyze(candidate, job(p));
  return computeFitScore(output);
}
async function out(p: Partial<JobAnalysisInput>) {
  return (await analyzer.analyze(candidate, job(p))).output;
}

describe('fit analysis (fake analyzer)', () => {
  it('scores a React/TypeScript frontend role strongly', async () => {
    const s = await score({});
    expect(s).toBeGreaterThanOrEqual(80);
    expect(['STRONG', 'GOOD']).toContain(fitStatusForScore(s));
  });

  it('exposes a major technical mismatch for a fundamentally .NET role', async () => {
    const o = await out({
      title: 'Senior .NET Full-stack Developer',
      description: 'Build services in C# and ASP.NET. Deep .NET expertise required.',
    });
    expect(o.technical_match.score).toBeLessThan(40);
    expect(computeFitScore(o)).toBeLessThan(60);
  });

  it('exposes a role mismatch for an AI/ML role', async () => {
    const o = await out({
      title: 'AI Software Engineer',
      description: 'Develop machine learning infrastructure in Python and PyTorch.',
    });
    expect(o.role_alignment.score).toBeLessThan(40);
  });

  it('treats a 5+ years requirement as a small gap, not a hard failure', async () => {
    const s = await score({ description: 'React + TypeScript frontend role. 5+ years of experience required.' });
    expect(s).toBeGreaterThanOrEqual(80);
  });

  it('penalizes a missing required skill more than a missing preferred one', async () => {
    const preferred = await out({ description: 'React + TypeScript role. GraphQL is nice to have.' });
    const required = await out({ description: 'React + TypeScript role. GraphQL required for this position.' });
    expect(preferred.technical_match.score).toBeGreaterThan(required.technical_match.score);
    expect(preferred.preferred_skill_gaps).toContain('GraphQL');
  });

  it('never invents an unsupported candidate skill', async () => {
    const o = await out({ title: 'Vue Developer', description: 'Build apps in Vue and Vuex.' });
    expect(o.matching_requirements).not.toContain('Vue');
    expect(JSON.stringify(o.matching_requirements)).not.toMatch(/vue/i);
  });

  it('does not let geographic uncertainty materially change the fit score', async () => {
    const eu = await out({ location: 'Remote — Europe' });
    const us = await out({ location: 'United States' });
    expect(Math.abs(computeFitScore(eu) - computeFitScore(us))).toBeLessThanOrEqual(3);
    // The uncertainty is surfaced separately, not scored.
    expect(us.uncertainties.length).toBeGreaterThan(0);
  });

  it('computes the weighted score from components (30/30/20/20)', () => {
    const s = computeFitScore({
      role_alignment: { score: 100, reasoning: '' },
      technical_match: { score: 100, reasoning: '' },
      experience_match: { score: 0, reasoning: '' },
      responsibility_match: { score: 0, reasoning: '' },
      matching_requirements: [], missing_requirements: [], preferred_skill_gaps: [],
      hard_requirement_concerns: [], uncertainties: [], summary: 'x', confidence: 'HIGH',
    });
    expect(s).toBe(60); // 0.3*100 + 0.3*100 + 0.2*0 + 0.2*0
  });

  it('rejects malformed model output via the schema (fails safe)', () => {
    expect(() => modelFitOutputSchema.parse({ role_alignment: { score: 'high' } })).toThrow();
    expect(() => modelFitOutputSchema.parse({})).toThrow();
  });

  it('assembles a full analysis with deterministic score and status', async () => {
    const o = await out({});
    const a = assembleFitAnalysis(o, {
      provider: 'fake', model: 'fake', promptVersion: 'p', scoringVersion: 's',
      profileVersion: 'v', contentHash: 'h', analyzedAt: 't', inputTokens: 1, outputTokens: 1,
    });
    expect(a.fit_score).toBe(computeFitScore(o));
    expect(a.fit_status).toBe(fitStatusForScore(a.fit_score));
  });
});

describe('analysis cache key', () => {
  const base = { profileVersion: 'v1', promptVersion: 'p1', scoringVersion: 's1', job: job({}) };
  it('is stable for identical inputs', () => {
    expect(analysisHash(base)).toBe(analysisHash({ ...base }));
  });
  it('changes when job content changes', () => {
    expect(analysisHash(base)).not.toBe(analysisHash({ ...base, job: job({ title: 'Different' }) }));
  });
  it('changes when profile / prompt / scoring version changes', () => {
    expect(analysisHash(base)).not.toBe(analysisHash({ ...base, profileVersion: 'v2' }));
    expect(analysisHash(base)).not.toBe(analysisHash({ ...base, promptVersion: 'p2' }));
    expect(analysisHash(base)).not.toBe(analysisHash({ ...base, scoringVersion: 's2' }));
  });
});
