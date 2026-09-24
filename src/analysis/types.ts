/**
 * Types for semantic fit analysis. The overall fit_score is NOT invented by the
 * model — the model returns four component scores + reasoning + evidence lists, and
 * we compute fit_score deterministically from the documented rubric weights.
 */

export type FitStatus = 'STRONG' | 'GOOD' | 'BORDERLINE' | 'POOR';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface FitComponent {
  score: number; // 0–100
  reasoning: string;
}

/** What the LLM returns (validated). Excludes fit_score/fit_status (we compute those). */
export interface ModelFitOutput {
  role_alignment: FitComponent;
  technical_match: FitComponent;
  experience_match: FitComponent;
  responsibility_match: FitComponent;
  matching_requirements: string[];
  missing_requirements: string[];
  preferred_skill_gaps: string[];
  hard_requirement_concerns: string[];
  uncertainties: string[];
  summary: string;
  confidence: Confidence;
}

/** The full stored analysis: model output + our deterministic score/status + metadata. */
export interface FitAnalysis extends ModelFitOutput {
  fit_score: number; // 0–100, deterministically weighted
  fit_status: FitStatus;
  meta: {
    provider: string;
    model: string;
    promptVersion: string;
    scoringVersion: string;
    profileVersion: string;
    contentHash: string;
    analyzedAt: string; // ISO
    inputTokens: number | null;
    outputTokens: number | null;
  };
}

/** Compact candidate representation sent to the analyzer (never the raw Markdown). */
export interface CandidateAnalysis {
  profileVersion: string;
  targetTitles: string[];
  totalYearsExperience: number;
  coreTechnologies: { name: string; years: number }[];
  professionalTechnologies: string[];
  limitedExperience: string[];
  noExperience: string[];
  domainStrengths: string[];
  education: { universityDegree: boolean; note: string };
  availability: string;
}

/** Compact job representation sent to the analyzer. */
export interface JobAnalysisInput {
  title: string | null;
  company: string | null;
  location: string | null;
  remoteType: string;
  employmentType: string | null;
  salary: string | null;
  description: string; // cleaned, stripped, truncated
}

/** Token usage returned alongside an analysis. */
export interface AnalyzerUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AnalyzerResult {
  output: ModelFitOutput;
  usage: AnalyzerUsage;
}

/**
 * The provider-agnostic analyzer boundary. Only one implementation is wired now
 * (Anthropic); tests use a deterministic fake. No multi-provider framework.
 */
export interface FitAnalyzer {
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly scoringVersion: string;
  analyze(candidate: CandidateAnalysis, job: JobAnalysisInput): Promise<AnalyzerResult>;
}
