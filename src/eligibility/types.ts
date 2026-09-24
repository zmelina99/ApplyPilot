import type { Job } from '../db/schema/jobs.js';

/** Deterministic eligibility verdict. `fit_score` is intentionally out of scope here
 * (Phase 2C) — this only decides hard eligibility, not semantic fit. */
export type EligibilityStatus = 'ELIGIBLE' | 'INELIGIBLE' | 'NEEDS_REVIEW';

/** Hard-fail reason codes → INELIGIBLE. */
export type IneligibleCode =
  | 'SALARY_BELOW_FLOOR'
  | 'LOCAL_WORK_AUTH_REQUIRED'
  | 'ONSITE_LOCATION_NOT_ALLOWED'
  | 'ROLE_OUT_OF_SCOPE'
  | 'TOO_OLD'
  | 'JUNIOR_ROLE';

/** Ambiguity reason codes → NEEDS_REVIEW. */
export type ReviewCode =
  | 'REMOTE_POLICY_AMBIGUOUS'
  | 'INTERNATIONAL_HIRING_AMBIGUOUS'
  | 'SALARY_COMPARISON_AMBIGUOUS'
  | 'ROLE_SCOPE_AMBIGUOUS'
  | 'LOCATION_AMBIGUOUS';

export type ReasonCode = IneligibleCode | ReviewCode;

export interface EligibilityReason {
  code: ReasonCode;
  /** INELIGIBLE reasons are "hard"; NEEDS_REVIEW reasons are "review". */
  kind: 'hard' | 'review';
  message: string;
}

export interface EligibilityResult {
  status: EligibilityStatus;
  reasons: EligibilityReason[];
  /** Short human-readable summary (stored on job_matches.eligibility_reason). */
  summary: string;
  /** True when posted within the freshness priority window (<=72h). */
  priority: boolean;
}

/** The subset of a stored Job the engine reasons over. */
export type EvaluableJob = Pick<
  Job,
  | 'title'
  | 'description'
  | 'locationText'
  | 'remoteType'
  | 'salaryMin'
  | 'salaryMax'
  | 'salaryCurrency'
  | 'salaryPeriod'
  | 'datePosted'
>;
