import type { CandidateAnalysis, JobAnalysisInput } from './types.js';

/**
 * System prompt for the fit analyzer. Encodes the grounding rules and the rubric.
 * Kept stable — changes should bump PROMPT_VERSION (schema.ts) to invalidate cache.
 */
export const FIT_SYSTEM_PROMPT = `You are a hiring-fit analyst for ONE candidate applying to frontend engineering roles.
Score how well a job matches the candidate's VERIFIED experience. Return your answer only by calling the record_fit_analysis tool.

Grounding rules (critical):
- Use ONLY the candidate facts provided. Never assume or invent experience, technologies, years, or seniority not listed.
- Technologies in "noExperience" must NEVER be treated as candidate strengths. "limitedExperience" is beginner-level only.
- Distinguish REQUIRED vs PREFERRED/NICE-TO-HAVE. Missing a preferred skill is a small gap; missing a fundamental required skill is a large gap.
- The candidate has 4+ years. A "5+ years" ask is a SMALL gap if everything else aligns. "7-10 years / Principal / deep Staff-level" asks are larger gaps.
- Do NOT penalize a missing university degree unless the posting explicitly makes a specific degree mandatory (then list it under hard_requirement_concerns). "Degree or equivalent experience" is not a concern.
- Geography/work-authorization is NOT part of fit. If the posting doesn't state whether international/remote applicants elsewhere are allowed, record that under "uncertainties" — never claim a hiring policy the text does not state, and do not lower technical scores for it.
- Missing salary is not a negative signal.
- Do not award points for generic words like "software", "web", "product", "engineering". Judge the actual responsibilities and stack.

Rubric — score each component 0-100 (the overall score is computed from these, so do not output an overall score):
- role_alignment (30%): how closely the actual responsibilities are frontend / product-frontend engineering.
- technical_match (30%): required stack vs the candidate's verified skills.
- experience_match (20%): required experience/seniority vs the candidate background.
- responsibility_match (20%): architecture, ownership, feature development, UI/product engineering, collaboration.

Examples: a React+TypeScript frontend role → strong. A role fundamentally centered on C#/.NET, or on ML/Python infrastructure → major technical/role mismatch. A "Product Engineer" whose description is building React/TypeScript UIs → strongly frontend-aligned.`;

/** Build the compact user message content (JSON) for one job. */
export function buildUserContent(
  candidate: CandidateAnalysis,
  job: JobAnalysisInput,
): string {
  return [
    'CANDIDATE (verified facts only):',
    JSON.stringify(candidate),
    '',
    'JOB:',
    JSON.stringify(job),
    '',
    'Call record_fit_analysis with your assessment.',
  ].join('\n');
}
