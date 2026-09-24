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
