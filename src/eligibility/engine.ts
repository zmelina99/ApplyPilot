import type { SearchConfig } from '../config/searchConfig.js';
import type {
  EligibilityReason,
  EligibilityResult,
  EvaluableJob,
} from './types.js';
import { htmlToText, includesAny } from './text.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function hard(code: EligibilityReason['code'], message: string): EligibilityReason {
  return { code, kind: 'hard', message };
}
function review(code: EligibilityReason['code'], message: string): EligibilityReason {
  return { code, kind: 'review', message };
}

/** ROLE / TITLE scope rules. Returns any hard/review reasons. */
export function evaluateRole(
  job: EvaluableJob,
  cfg: SearchConfig,
): EligibilityReason[] {
  const reasons: EligibilityReason[] = [];
  const title = (job.title ?? '').toLowerCase();
  const bodyText = htmlToText(job.description);
  const titleAndBody = `${title} ${bodyText}`;
  const r = cfg.role;

  if (includesAny(title, r.excludeSeniorityKeywords)) {
    reasons.push(hard('ROLE_OUT_OF_SCOPE', 'Excluded seniority (e.g. Principal).'));
  }
  if (includesAny(title, r.juniorTitleKeywords)) {
    reasons.push(hard('JUNIOR_ROLE', 'Junior/intern/entry-level role.'));
  }
  const leadAllowed = includesAny(title, r.leadAllowedKeywords);
  if (includesAny(title, r.managementTitleKeywords) && !leadAllowed) {
    reasons.push(hard('ROLE_OUT_OF_SCOPE', 'Pure management role.'));
  }

  const titleFrontend = includesAny(title, r.frontendKeywords);
  const bodyFrontend = includesAny(titleAndBody, r.frontendKeywords);
  const titleOutOfScope = includesAny(title, r.outOfScopeTitleKeywords);
  const titleAdjacent = includesAny(title, r.adjacentTitleKeywords);

  if (titleFrontend) {
    // In scope. Staff titles must not auto-qualify → route to review.
    if (includesAny(title, r.reviewSeniorityKeywords)) {
      reasons.push(review('ROLE_SCOPE_AMBIGUOUS', 'Staff-level role needs review.'));
    }
  } else if (titleOutOfScope) {
    reasons.push(hard('ROLE_OUT_OF_SCOPE', 'Out-of-scope role (backend/data/QA/design/etc.).'));
  } else if (titleAdjacent) {
    // Adjacent titles (full-stack / software / web / product engineer) qualify only
    // with a clear frontend signal in title or description; otherwise review.
    if (!bodyFrontend) {
      reasons.push(review('ROLE_SCOPE_AMBIGUOUS', 'Adjacent title without a clear frontend signal.'));
    }
  } else {
    // Unknown title that is neither frontend nor a recognized adjacent role. Never
    // auto-qualify on a description keyword alone (avoids e.g. a Golang/Controls role
    // slipping in because its long description mentions JavaScript). Route to review.
    reasons.push(review('ROLE_SCOPE_AMBIGUOUS', 'Role scope unclear from title.'));
  }

  return reasons;
}

/** FRESHNESS rule. Missing date is NOT a rejection. */
export function evaluateFreshness(
  job: EvaluableJob,
  cfg: SearchConfig,
  now: Date,
): EligibilityReason[] {
  if (!job.datePosted) return [];
  const ageDays = (now.getTime() - job.datePosted.getTime()) / DAY_MS;
  if (ageDays > cfg.freshness.maxAgeDays) {
    return [hard('TOO_OLD', `Posted ${Math.floor(ageDays)}d ago (> ${cfg.freshness.maxAgeDays}d).`)];
  }
  return [];
}

/** LOCATION / WORK-AUTHORIZATION rules. */
export function evaluateLocation(
  job: EvaluableJob,
  cfg: SearchConfig,
): EligibilityReason[] {
  const loc = (job.locationText ?? '').toLowerCase();
  const full = `${(job.title ?? '').toLowerCase()} ${loc} ${htmlToText(job.description)}`;
  const L = cfg.location;

  const eligibleByCityOrSwiss =
    includesAny(loc, L.onsiteAllowedCities) || includesAny(loc, L.switzerlandTokens);
  const eligibleEurope =
    includesAny(loc, L.europeRemoteSignals) ||
    includesAny(loc, L.europeCountryTokens) ||
    includesAny(loc, L.europeCityTokens);
  // International-remote eligibility is decided from the LOCATION field only, not the
  // free-text description (boilerplate like "global"/"remote" there is not a hiring
  // signal). Residency requirements, by contrast, are still scanned in the full text.
  const eligibleIntl = includesAny(loc, L.internationalRemoteSignals);
  const eligibleArg = includesAny(loc, L.argentinaTokens);
  const residencyRequired = includesAny(full, L.outsideResidencySignals);
  const northAmericaOrUk =
    includesAny(loc, L.northAmericaTokens) || includesAny(loc, L.ukTokens);

  if (job.remoteType === 'ONSITE' || job.remoteType === 'HYBRID') {
    if (eligibleByCityOrSwiss) return [];
    if (loc === '') return [review('LOCATION_AMBIGUOUS', 'On-site/hybrid with unknown location.')];
    return [hard('ONSITE_LOCATION_NOT_ALLOWED', 'On-site/hybrid outside Valencia/Switzerland.')];
  }

  // REMOTE (and UNKNOWN, treated best-effort as remote):
  if (eligibleByCityOrSwiss || eligibleIntl || eligibleEurope || eligibleArg) return [];
  if (residencyRequired) {
    return [hard('LOCAL_WORK_AUTH_REQUIRED', 'Requires local residence/work authorization.')];
  }
  if (northAmericaOrUk) {
    return [review('INTERNATIONAL_HIRING_AMBIGUOUS', 'US/Canada/UK location; international hiring unclear.')];
  }
  return [review('REMOTE_POLICY_AMBIGUOUS', 'Remote region/eligibility unclear.')];
}

/** SALARY rule. Only compares within EUR/CHF; foreign currencies are not guessed. */
export function evaluateSalary(
  job: EvaluableJob,
  cfg: SearchConfig,
): EligibilityReason[] {
  const hasNumbers = job.salaryMin != null || job.salaryMax != null;
  if (!hasNumbers || !job.salaryCurrency) return []; // missing salary → do not reject
  const cur = job.salaryCurrency.toUpperCase();
  const comparable = cfg.salary.comparableCurrencies.includes(cur);
  const top = Number(job.salaryMax ?? job.salaryMin);
  if (!Number.isFinite(top) || top <= 0) return [];

  if (!comparable) return []; // foreign currency → not decisive, do not guess/convert

  if (job.salaryPeriod !== 'YEAR') {
    return [review('SALARY_COMPARISON_AMBIGUOUS', `${cur} salary with non-annual period.`)];
  }
  const floor = cfg.salary.floors[cur];
  if (floor != null && top < floor) {
    return [hard('SALARY_BELOW_FLOOR', `Top ${cur} ${top} below floor ${floor}.`)];
  }
  return [];
}

/** Run all deterministic rules and aggregate into a single verdict. No LLM. */
export function evaluateEligibility(
  job: EvaluableJob,
  cfg: SearchConfig,
  now: Date = new Date(),
): EligibilityResult {
  const reasons: EligibilityReason[] = [
    ...evaluateRole(job, cfg),
    ...evaluateFreshness(job, cfg, now),
    ...evaluateLocation(job, cfg),
    ...evaluateSalary(job, cfg),
  ];

  const hardReasons = reasons.filter((r) => r.kind === 'hard');
  const reviewReasons = reasons.filter((r) => r.kind === 'review');

  let status: EligibilityResult['status'];
  let summary: string;
  if (hardReasons.length > 0) {
    status = 'INELIGIBLE';
    summary = hardReasons.map((r) => r.code).join(', ');
  } else if (reviewReasons.length > 0) {
    status = 'NEEDS_REVIEW';
    summary = reviewReasons.map((r) => r.code).join(', ');
  } else {
    status = 'ELIGIBLE';
    summary = 'Passes all deterministic hard constraints.';
  }

  const priority =
    job.datePosted != null &&
    now.getTime() - job.datePosted.getTime() <= cfg.freshness.priorityHours * HOUR_MS;

  return { status, reasons, summary, priority };
}
