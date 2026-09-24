import type { CandidateFacts } from '../config/candidateFacts.js';
import type { CandidateAnalysis } from './types.js';

/**
 * Build the compact candidate object sent to the analyzer from verified facts only.
 * No personal identifiers, no Markdown, nothing not present in candidate-facts.json.
 */
export function buildCandidateAnalysis(facts: CandidateFacts): CandidateAnalysis {
  return {
    profileVersion: facts.profileVersion,
    targetTitles: facts.targetTitles,
    totalYearsExperience: facts.totalYearsExperience,
    coreTechnologies: facts.coreTechnologies,
    professionalTechnologies: facts.professionalTechnologies,
    limitedExperience: facts.limitedExperience,
    noExperience: facts.noExperience,
    domainStrengths: facts.domainStrengths,
    education: {
      universityDegree: facts.education.universityDegree,
      note: `${facts.education.highest}; ${facts.education.additional}`,
    },
    availability: facts.availability,
  };
}
