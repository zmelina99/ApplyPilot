import { describe, it, expect } from 'vitest';
import { loadCandidateFacts } from '../src/config/candidateFacts.js';
import { buildCandidateAnalysis } from '../src/analysis/candidateAnalysis.js';

const facts = loadCandidateFacts();
const analysis = buildCandidateAnalysis(facts);

describe('candidate facts (verified only)', () => {
  it('includes core technologies with the approved years', () => {
    const react = facts.coreTechnologies.find((t) => t.name === 'React');
    expect(react?.years).toBe(4);
    expect(facts.totalYearsExperience).toBe(4);
  });

  it('does not invent numeric years for professional technologies', () => {
    // Professional techs are strings (no year), not {name, years} objects.
    expect(facts.professionalTechnologies).toContain('Redux');
    expect(facts.professionalTechnologies.every((t) => typeof t === 'string')).toBe(true);
    // None of the professional techs are secretly in coreTechnologies with a year.
    for (const t of facts.professionalTechnologies) {
      expect(facts.coreTechnologies.some((c) => c.name === t)).toBe(false);
    }
  });

  it('keeps unsupported technologies unsupported (never as strengths)', () => {
    for (const tech of ['Vue', 'Angular', 'Svelte', 'GraphQL', 'AWS', 'Azure', 'Playwright']) {
      expect(facts.noExperience).toContain(tech);
      expect(facts.professionalTechnologies).not.toContain(tech);
      expect(facts.coreTechnologies.some((c) => c.name === tech)).toBe(false);
    }
  });

  it('the analysis object carries the profile version and no personal identifiers', () => {
    expect(analysis.profileVersion).toBe(facts.profileVersion);
    const json = JSON.stringify(analysis);
    expect(json).not.toMatch(/@|phone|linkedin|melina/i);
  });

  it('records no university degree truthfully', () => {
    expect(facts.education.universityDegree).toBe(false);
    expect(analysis.education.universityDegree).toBe(false);
  });
});
