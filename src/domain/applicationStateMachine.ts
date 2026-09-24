import type { Application } from '../db/schema/applications.js';

/**
 * Application execution state machine. This is pure domain logic — no database
 * access — so the rules are testable and live in exactly one place, not implicitly
 * inside queries.
 */
export type ApplicationStatus = Application['status'];

/**
 * Allowed transitions. APPLIED is intentionally absent as a key: it is terminal, so
 * no transition out of it is permitted (no accidental restart / double submission).
 */
const TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  QUEUED: ['APPLYING'],
  APPLYING: [
    'NEEDS_USER_INPUT',
    'LOGIN_REQUIRED',
    'CAPTCHA',
    'AUTOMATION_FAILED',
    'MANUAL_REVIEW',
    'READY_FOR_APPROVAL',
    'APPLIED',
  ],
  NEEDS_USER_INPUT: ['QUEUED'],
  LOGIN_REQUIRED: ['QUEUED'],
  CAPTCHA: ['QUEUED'],
  AUTOMATION_FAILED: ['QUEUED'],
  MANUAL_REVIEW: ['READY_FOR_APPROVAL'],
  READY_FOR_APPROVAL: ['APPLIED'],
  APPLIED: [], // terminal
};

/** Status an application is created in. */
export const INITIAL_STATUS: ApplicationStatus = 'QUEUED';

/** Terminal statuses (no outgoing transitions). */
export function isTerminal(status: ApplicationStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Whether `from -> to` is a permitted transition. */
export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/** All statuses reachable from `from` in one step. */
export function allowedNext(from: ApplicationStatus): readonly ApplicationStatus[] {
  return TRANSITIONS[from];
}
