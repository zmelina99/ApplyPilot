import { z } from 'zod';
import type { FitStatus, ModelFitOutput } from './types.js';

/**
 * Versions that participate in the analysis cache key. Bumping any of these
 * invalidates cached analyses (forcing re-analysis).
 */
export const PROMPT_VERSION = 'fit-prompt-1';
export const SCORING_VERSION = 'fit-scoring-1';

/**
 * Documented scoring rubric (weights sum to 1.0). Geography and salary are
 * intentionally NOT components — they are eligibility/opportunity attributes, not
 * evidence of technical fit.
 */
export const RUBRIC_WEIGHTS = {
  role_alignment: 0.3, // responsibilities match frontend/product engineering
  technical_match: 0.3, // required stack vs verified skills
  experience_match: 0.2, // required experience/seniority vs candidate background
  responsibility_match: 0.2, // architecture/ownership/feature/UI collaboration
} as const;

const component = z.object({
  score: z.number().min(0).max(100),
  reasoning: z.string().min(1),
});

/** Validates the LLM's structured output. Malformed output fails (never accepted). */
export const modelFitOutputSchema = z.object({
  role_alignment: component,
  technical_match: component,
  experience_match: component,
  responsibility_match: component,
  matching_requirements: z.array(z.string()),
  missing_requirements: z.array(z.string()),
  preferred_skill_gaps: z.array(z.string()),
  hard_requirement_concerns: z.array(z.string()),
  uncertainties: z.array(z.string()),
  summary: z.string().min(1),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

/** JSON Schema for the analyzer tool (kept in sync with the zod schema above). */
export const FIT_TOOL_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    role_alignment: componentJsonSchema('How closely actual responsibilities match frontend/product engineering.'),
    technical_match: componentJsonSchema('Match between the required stack and the candidate\'s verified skills.'),
    experience_match: componentJsonSchema('Alignment between required experience/seniority and the candidate background.'),
    responsibility_match: componentJsonSchema('Alignment with architecture, ownership, feature development, UI/product engineering, collaboration.'),
    matching_requirements: strArray('Requirements the candidate clearly meets, grounded in verified facts.'),
    missing_requirements: strArray('Required things the candidate lacks.'),
    preferred_skill_gaps: strArray('Preferred/nice-to-have skills the candidate lacks (minor).'),
    hard_requirement_concerns: strArray('Explicit hard requirements that may be genuine blockers (e.g. mandatory specific degree).'),
    uncertainties: strArray('Unknowns from the posting (e.g. unclear international hiring). Never state a policy the text does not.'),
    summary: { type: 'string', description: 'One to three sentence plain-English summary.' },
    confidence: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
  },
  required: [
    'role_alignment', 'technical_match', 'experience_match', 'responsibility_match',
    'matching_requirements', 'missing_requirements', 'preferred_skill_gaps',
    'hard_requirement_concerns', 'uncertainties', 'summary', 'confidence',
  ],
} as const;

function componentJsonSchema(description: string) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      score: { type: 'integer', minimum: 0, maximum: 100 },
      reasoning: { type: 'string' },
    },
    required: ['score', 'reasoning'],
    description,
  };
}
function strArray(description: string) {
  return { type: 'array', items: { type: 'string' }, description };
}

/** Deterministically compute the weighted overall fit score (0–100). */
export function computeFitScore(o: ModelFitOutput): number {
  const total =
    o.role_alignment.score * RUBRIC_WEIGHTS.role_alignment +
    o.technical_match.score * RUBRIC_WEIGHTS.technical_match +
    o.experience_match.score * RUBRIC_WEIGHTS.experience_match +
    o.responsibility_match.score * RUBRIC_WEIGHTS.responsibility_match;
  return Math.round(total);
}

/** Map a fit score to a status band. */
export function fitStatusForScore(score: number): FitStatus {
  if (score >= 85) return 'STRONG';
  if (score >= 70) return 'GOOD';
  if (score >= 50) return 'BORDERLINE';
  return 'POOR';
}
