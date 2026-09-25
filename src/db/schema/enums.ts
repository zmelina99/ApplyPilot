import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Controlled vocabularies enforced at the database level as PostgreSQL enums.
 * Keeping these as real enum types (not free text) prevents invalid values from
 * ever being written, in any language or interface.
 */

// --- Jobs (global posting) ---
export const remoteTypeEnum = pgEnum('remote_type', [
  'REMOTE',
  'HYBRID',
  'ONSITE',
  'UNKNOWN',
]);

export const employmentTypeEnum = pgEnum('employment_type', [
  'PERMANENT',
  'FIXED_TERM',
  'CONTRACT',
  'FREELANCE',
  'EOR',
  'UNKNOWN',
]);

export const salaryPeriodEnum = pgEnum('salary_period', [
  'YEAR',
  'MONTH',
  'WEEK',
  'DAY',
  'HOUR',
]);

export const postingStatusEnum = pgEnum('posting_status', [
  'ACTIVE',
  'EXPIRED',
  'CLOSED',
  'UNKNOWN',
]);

// --- Job match (evaluation of one job for one user) ---
export const matchStatusEnum = pgEnum('match_status', [
  'PENDING',
  'FILTERED',
  'QUALIFIED',
  'REJECTED',
]);

export const eligibilityStatusEnum = pgEnum('eligibility_status', [
  'PENDING',
  'ELIGIBLE',
  'INELIGIBLE',
  'AMBIGUOUS',
]);

export const fitStatusEnum = pgEnum('fit_status', [
  'PENDING',
  'STRONG',
  'MODERATE',
  'WEAK',
  // Phase 2C semantic-fit bands (STRONG reused):
  'GOOD',
  'BORDERLINE',
  'POOR',
]);

// --- Application (one user's attempt to apply to one job) ---
export const applicationStatusEnum = pgEnum('application_status', [
  'QUEUED',
  'APPLYING',
  'NEEDS_USER_INPUT',
  'LOGIN_REQUIRED',
  'CAPTCHA',
  'AUTOMATION_FAILED',
  'MANUAL_REVIEW',
  'READY_FOR_APPROVAL',
  'APPLIED',
]);

// --- Application events (append-only audit) ---
export const applicationEventTypeEnum = pgEnum('application_event_type', [
  'APPLICATION_CREATED',
  'STATUS_CHANGED',
  'APPLICATION_STARTED',
  'USER_INPUT_REQUIRED',
  'USER_APPROVED',
  'USER_REJECTED',
  'LOGIN_REQUIRED',
  'CAPTCHA_ENCOUNTERED',
  'AUTOMATION_FAILED',
  'APPLICATION_SUBMITTED',
  // Phase 2D — supervised application preparation:
  'PROVIDER_DETECTED',
  'FORM_INSPECTED',
  'QUESTION_DISCOVERED',
  'ANSWER_PROPOSED',
  'USER_ANSWERED',
  'PREPARATION_VALIDATED',
  'READY_FOR_APPROVAL',
  'PREPARATION_APPROVED',
]);

// --- Phase 2D: application preparation ---
export const applicationProviderEnum = pgEnum('application_provider', [
  'GREENHOUSE',
  'LEVER',
  'ASHBY',
  'WORKABLE',
  'SMARTRECRUITERS',
  'RECRUITEE',
  'CUSTOM',
  'AGGREGATOR',
  'UNKNOWN',
]);

export const questionCategoryEnum = pgEnum('question_category', [
  'NAME', 'EMAIL', 'PHONE', 'LOCATION', 'LINKEDIN', 'GITHUB', 'PORTFOLIO',
  'RESUME', 'YEARS_EXPERIENCE', 'TECH_YEARS', 'WORK_AUTHORIZATION', 'SPONSORSHIP',
  'SALARY_EXPECTATION', 'AVAILABILITY', 'EDUCATION', 'LANGUAGE', 'RELOCATION',
  'EEO', 'COVER_LETTER', 'WHY_COMPANY', 'FREE_TEXT', 'UNKNOWN',
]);

export const questionSourceKindEnum = pgEnum('question_source_kind', [
  'PROVIDER_FORM',
  'STANDARD',
]);

export const answerSourceEnum = pgEnum('answer_source', [
  'PROFILE', 'APPROVED_ANSWER', 'DETERMINISTIC_RULE', 'GENERATED', 'USER', 'UNKNOWN',
]);

export const answerStatusEnum = pgEnum('answer_status', [
  'READY', 'NEEDS_INPUT', 'NEEDS_GENERATION', 'OPTIONAL_BLANK', 'UNSUPPORTED',
]);

// --- Review queue ---
export const reviewTypeEnum = pgEnum('review_type', [
  'INITIAL_APPLICATION_APPROVAL',
  'SWISS_APPLICATION',
  'EXCEPTIONAL_STARTUP',
  'MISSING_INFORMATION',
  'AMBIGUOUS_ELIGIBILITY',
  'SALARY_QUESTION',
  'LOGIN_REQUIRED',
  'CAPTCHA',
  'AUTOMATION_FAILURE',
  'OTHER',
]);

export const reviewStatusEnum = pgEnum('review_status', [
  'OPEN',
  'RESOLVED',
  'DISMISSED',
]);

// --- Automation approval lifecycle ---
export const automationApprovalStatusEnum = pgEnum('automation_approval_status', [
  'NOT_REQUESTED',
  'AWAITING_AUTOMATION_APPROVAL',
  'APPROVED',
  'DECLINED',
]);
