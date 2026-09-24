import type { FitAnalysis, ModelFitOutput } from './types.js';
import { computeFitScore, fitStatusForScore } from './schema.js';

/**
 * Combine the model's validated component output with our deterministic weighted
 * score, status band, and cache/provenance metadata into the stored FitAnalysis.
 */
export function assembleFitAnalysis(
  output: ModelFitOutput,
  meta: FitAnalysis['meta'],
): FitAnalysis {
  const fit_score = computeFitScore(output);
  const fit_status = fitStatusForScore(fit_score);
  return { ...output, fit_score, fit_status, meta };
}
