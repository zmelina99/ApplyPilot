import type {
  AnalyzerResult,
  CandidateAnalysis,
  FitAnalyzer,
  JobAnalysisInput,
  ModelFitOutput,
} from './types.js';
import { PROMPT_VERSION, SCORING_VERSION } from './schema.js';

/**
 * Deterministic, offline fit analyzer for tests and demos. It applies simple keyword
 * heuristics — NOT a real LLM — but it honors the grounding rules: it only credits
 * technologies present in the candidate's verified facts, treats preferred gaps as
 * smaller than required gaps, and treats a 5+ years ask as a small gap.
 */
export class FakeFitAnalyzer implements FitAnalyzer {
  readonly provider = 'fake';
  readonly model = 'fake-analyzer';
  readonly promptVersion = PROMPT_VERSION;
  readonly scoringVersion = SCORING_VERSION;

  // Optional override hook so a test can force a specific output.
  constructor(private readonly override?: (job: JobAnalysisInput) => ModelFitOutput) {}

  async analyze(
    candidate: CandidateAnalysis,
    job: JobAnalysisInput,
  ): Promise<AnalyzerResult> {
    if (this.override) {
      return { output: this.override(job), usage: { inputTokens: 100, outputTokens: 50 } };
    }
    const text = `${job.title ?? ''} ${job.description}`.toLowerCase();
    const has = (...w: string[]) => w.some((x) => text.includes(x));
    const candidateHas = (name: string) =>
      candidate.coreTechnologies.some((t) => t.name.toLowerCase() === name) ||
      candidate.professionalTechnologies.map((t) => t.toLowerCase()).includes(name);

    const frontend = has('frontend', 'front-end', 'react', 'typescript', 'next.js', 'ui ', 'user interface');
    const dotnet = has('.net', 'c#', 'asp.net');
    const ml = has('machine learning', 'pytorch', 'tensorflow', 'ml infrastructure', 'ml engineer', 'data science');
    const backendCentric = has('backend', 'golang', 'rust', 'kubernetes cluster') && !frontend;

    const matching: string[] = [];
    const missing: string[] = [];
    const preferredGaps: string[] = [];

    if (has('react') && candidateHas('react')) matching.push('React');
    if (has('typescript') && candidateHas('typescript')) matching.push('TypeScript');
    if (has('next.js') && candidateHas('next.js')) matching.push('Next.js');

    // Required vs preferred detection for a couple of common non-verified techs.
    for (const tech of candidate.noExperience) {
      const t = tech.toLowerCase();
      if (!text.includes(t)) continue;
      const window = sliceAround(text, t, 40);
      if (/nice to have|preferred|a plus|bonus/.test(window)) preferredGaps.push(tech);
      else missing.push(`${tech} (required, not in verified profile)`);
    }

    // Component scores.
    let role = frontend ? 90 : ml || backendCentric ? 25 : 55;
    let technical = 90;
    if (!frontend) technical -= 30;
    if (dotnet) technical = 20; // fundamentally .NET → major mismatch
    if (ml) technical = 25;
    technical -= missing.length * 20; // fundamental required gaps
    technical -= preferredGaps.length * 5; // preferred gaps are small
    if (matching.length === 0 && frontend) technical -= 10;
    technical = clamp(technical);
    role = clamp(role);

    let experience = 85;
    if (/7\+|8\+|9\+|10\+|principal|deep staff|staff-level architecture/.test(text)) experience = 50;
    // "5+ years" alone is a small gap only.
    let responsibility = frontend ? 85 : ml || backendCentric ? 35 : 60;
    responsibility = clamp(responsibility);
    experience = clamp(experience);

    const concerns: string[] = [];
    if (/(bachelor|master|degree)\s+(is\s+)?(required|mandatory)/.test(text)) {
      concerns.push('Posting appears to require a specific degree.');
    }
    const uncertainties: string[] = [];
    if (job.location && /united states|usa|canada|uk|united kingdom/i.test(job.location) &&
        !/worldwide|anywhere|europe/i.test(job.location)) {
      uncertainties.push('Employer lists specific countries; explicit international-hiring restriction is unclear.');
    }

    const output: ModelFitOutput = {
      role_alignment: { score: role, reasoning: frontend ? 'Frontend-focused responsibilities.' : 'Limited frontend focus.' },
      technical_match: { score: technical, reasoning: `Verified matches: ${matching.join(', ') || 'none'}.` },
      experience_match: { score: experience, reasoning: '4+ years vs stated requirement.' },
      responsibility_match: { score: responsibility, reasoning: frontend ? 'UI/feature ownership aligns.' : 'Non-frontend responsibilities.' },
      matching_requirements: matching,
      missing_requirements: missing,
      preferred_skill_gaps: preferredGaps,
      hard_requirement_concerns: concerns,
      uncertainties,
      summary: frontend ? 'Frontend-aligned role.' : 'Weak frontend alignment.',
      confidence: 'MEDIUM',
    };
    return { output, usage: { inputTokens: 200, outputTokens: 120 } };
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
function sliceAround(text: string, needle: string, radius: number): string {
  const i = text.indexOf(needle);
  if (i < 0) return '';
  return text.slice(Math.max(0, i - radius), i + needle.length + radius);
}
