import type { Database } from '../db/client.js';
import { loadCandidateFacts } from '../config/candidateFacts.js';
import { matchesRepo, reviewsRepo, usersRepo } from '../repositories/index.js';
import type { MatchWithJob } from '../repositories/jobMatches.js';
import { buildCandidateAnalysis } from '../analysis/candidateAnalysis.js';
import { buildJobAnalysisInput, analysisHash } from '../analysis/jobContent.js';
import { assembleFitAnalysis } from '../analysis/assemble.js';
import { PROMPT_VERSION, SCORING_VERSION } from '../analysis/schema.js';
import type { CandidateAnalysis, FitAnalyzer, JobAnalysisInput } from '../analysis/types.js';

/** Review types that Phase 2B produced purely for non-blocking ambiguity. */
const NON_BLOCKING_REVIEW_TYPES = ['AMBIGUOUS_ELIGIBILITY', 'SALARY_QUESTION', 'OTHER'] as const;

export interface AnalyzeTarget {
  mw: MatchWithJob;
  jobInput: JobAnalysisInput;
  hash: string;
  cached: boolean;
}

export interface AnalyzePlan {
  totalMatches: number;
  eligible: number;
  nonBlockingAmbiguous: number;
  deterministicRejectsSkipped: number;
  alreadyCached: number;
  wouldAnalyze: number;
  targets: AnalyzeTarget[];
}

export interface AnalyzeStats {
  analyzed: number;
  cacheHits: number;
  llmCalls: number;
  failed: number;
  inputTokens: number;
  outputTokens: number;
  errors: { jobId: string; error: string }[];
}

/** Build the (read-only) analysis plan: which matches would be analyzed and why. */
export async function planAnalysis(
  db: Database,
  candidate: CandidateAnalysis,
): Promise<AnalyzePlan> {
  const user = await usersRepo.getFirstUser(db);
  if (!user) {
    return {
      totalMatches: 0, eligible: 0, nonBlockingAmbiguous: 0,
      deterministicRejectsSkipped: 0, alreadyCached: 0, wouldAnalyze: 0, targets: [],
    };
  }

  // Analyzable = ELIGIBLE + non-blocking AMBIGUOUS. Deterministic rejects are skipped.
  const eligibleRows = await matchesRepo.listMatchesWithJobsByEligibility(db, user.id, ['ELIGIBLE']);
  const ambiguousRows = await matchesRepo.listMatchesWithJobsByEligibility(db, user.id, ['AMBIGUOUS']);
  const rejected = await matchesRepo.listMatchesWithJobsByEligibility(db, user.id, ['INELIGIBLE']);

  const analyzable = [...eligibleRows, ...ambiguousRows];
  const targets: AnalyzeTarget[] = analyzable.map((mw) => {
    const jobInput = buildJobAnalysisInput(mw.job);
    const hash = analysisHash({
      profileVersion: candidate.profileVersion,
      promptVersion: PROMPT_VERSION,
      scoringVersion: SCORING_VERSION,
      job: jobInput,
    });
    const cached = mw.match.fitAnalysisHash === hash && mw.match.fitAnalysis != null;
    return { mw, jobInput, hash, cached };
  });

  const alreadyCached = targets.filter((t) => t.cached).length;
  return {
    totalMatches: analyzable.length + rejected.length,
    eligible: eligibleRows.length,
    nonBlockingAmbiguous: ambiguousRows.length,
    deterministicRejectsSkipped: rejected.length,
    alreadyCached,
    wouldAnalyze: targets.length - alreadyCached,
    targets,
  };
}

/**
 * Dismiss OPEN non-blocking ambiguity review items (they are superseded by fit
 * analysis, which attaches the uncertainty to the match instead). Deterministic — no
 * LLM. Returns how many were dismissed.
 */
export async function cleanupNonBlockingReviews(db: Database): Promise<number> {
  const user = await usersRepo.getFirstUser(db);
  if (!user) return 0;
  return reviewsRepo.dismissReviewsByTypes(
    db,
    user.id,
    [...NON_BLOCKING_REVIEW_TYPES],
    'Superseded by semantic fit analysis (non-blocking uncertainty attached to the match).',
  );
}

/**
 * Run semantic fit analysis for all targets that need it (cache misses). Persists
 * validated results; malformed analyses fail safely (counted, not persisted). Cached
 * targets make ZERO LLM calls.
 */
export async function runAnalysis(
  db: Database,
  candidate: CandidateAnalysis,
  analyzer: FitAnalyzer,
  plan: AnalyzePlan,
): Promise<AnalyzeStats> {
  const stats: AnalyzeStats = {
    analyzed: 0, cacheHits: 0, llmCalls: 0, failed: 0,
    inputTokens: 0, outputTokens: 0, errors: [],
  };

  for (const target of plan.targets) {
    if (target.cached) {
      stats.cacheHits += 1;
      continue;
    }
    try {
      const { output, usage } = await analyzer.analyze(candidate, target.jobInput);
      stats.llmCalls += 1;
      stats.inputTokens += usage.inputTokens ?? 0;
      stats.outputTokens += usage.outputTokens ?? 0;

      const analysis = assembleFitAnalysis(output, {
        provider: analyzer.provider,
        model: analyzer.model,
        promptVersion: analyzer.promptVersion,
        scoringVersion: analyzer.scoringVersion,
        profileVersion: candidate.profileVersion,
        contentHash: target.hash,
        analyzedAt: new Date().toISOString(),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });

      await matchesRepo.saveFitAnalysis(db, target.mw.match.id, {
        fitScore: analysis.fit_score,
        fitStatus: analysis.fit_status,
        fitReason: analysis.summary,
        fitAnalysis: analysis,
        fitAnalysisHash: target.hash,
        fitModel: analyzer.model,
        fitPromptVersion: analyzer.promptVersion,
      });
      stats.analyzed += 1;
    } catch (err) {
      stats.failed += 1;
      stats.errors.push({
        jobId: target.mw.job.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return stats;
}

export { loadCandidateFacts, buildCandidateAnalysis };
