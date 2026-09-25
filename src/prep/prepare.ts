import type { Database } from '../db/client.js';
import type { Job } from '../db/schema/jobs.js';
import type { ApplicationStatus } from '../domain/applicationStateMachine.js';
import { shortestPath } from '../domain/applicationStateMachine.js';
import {
  usersRepo, jobsRepo, jobSourcesRepo, matchesRepo, applicationsRepo, eventsRepo, prepRepo, automationRepo,
} from '../repositories/index.js';
import { namedTech } from './classify.js';
import { loadCandidateFacts } from '../config/candidateFacts.js';
import { loadCandidateIdentity } from '../config/candidateIdentity.js';
import { loadSearchConfig } from '../config/searchConfig.js';
import { detectDefaultResume } from './resume.js';
import { resolveApplyUrl, inspectDestination, httpFetcher, type Fetcher } from './resolve.js';
import { classifyQuestion } from './classify.js';
import { answerQuestion, type AnswerContext, type PrepQuestion } from './answer.js';
import { standardQuestions } from './standardQuestions.js';
import type { PreparedItem } from '../repositories/applicationPrep.js';
import type { NewApplicationQuestion, NewApplicationAnswer } from '../db/schema/applicationPrep.js';

const SWISS = /switzerland|schweiz|suisse|svizzera|zurich|zürich|geneva|genève|basel|bern|lausanne|lugano|ticino/i;

export interface PrepSummary {
  jobId: string;
  company: string | null;
  title: string | null;
  applicationId: string | null;
  provider: string;
  applyUrl: string;
  supported: boolean;
  gated: boolean;
  status: ApplicationStatus | 'DRY_RUN';
  questionCount: number;
  answers: { ready: number; needsInput: number; needsGeneration: number; optionalBlank: number };
  resumeStatus: string;
  note: string | null;
}

async function buildContext(db: Database, job: Job): Promise<AnswerContext> {
  const facts = loadCandidateFacts();
  const identity = loadCandidateIdentity();
  const cfg = loadSearchConfig();
  const user = await usersRepo.getFirstUser(db);
  const saved = user ? await prepRepo.getSavedAnswersMap(db, user.id) : new Map<string, string>();
  const resume = detectDefaultResume();
  const swissRole = SWISS.test(job.locationText ?? '') || (job.salaryCurrency ?? '').toUpperCase() === 'CHF';
  return { facts, identity, salary: cfg.salary, swissRole, resumeAvailable: resume.available, saved };
}

/** Build the (question, proposed-answer) pairs for a job from an inspection result. */
function buildItems(
  inspect: { supported: boolean; questions: { providerFieldId?: string | null; label: string; fieldType: string; required: boolean; options?: string[] | null }[] },
  ctx: AnswerContext,
): PreparedItem[] {
  const source: NewApplicationQuestion['sourceKind'] = inspect.supported ? 'PROVIDER_FORM' : 'STANDARD';
  const raw = inspect.supported
    ? inspect.questions.map((q) => ({
        ...q,
        category: classifyQuestion(q.label, q.fieldType),
      }))
    : standardQuestions();

  return raw.map((q) => {
    const pq: PrepQuestion = { label: q.label, category: q.category, fieldType: q.fieldType, required: q.required, options: q.options ?? null };
    const a = answerQuestion(pq, ctx);
    const question: PreparedItem['question'] = {
      providerFieldId: ('providerFieldId' in q ? q.providerFieldId : null) ?? null,
      label: q.label,
      fieldType: q.fieldType,
      required: q.required,
      options: (q.options ?? null) as NewApplicationQuestion['options'],
      category: q.category,
      sourceKind: source,
    };
    const answer: PreparedItem['answer'] = {
      value: a.value,
      answerSource: a.source as NewApplicationAnswer['answerSource'],
      confidence: a.confidence,
      status: a.status as NewApplicationAnswer['status'],
    };
    return { question, answer };
  });
}

function tally(items: PreparedItem[]): PrepSummary['answers'] {
  const t = { ready: 0, needsInput: 0, needsGeneration: 0, optionalBlank: 0 };
  for (const it of items) {
    if (it.answer.status === 'READY') t.ready++;
    else if (it.answer.status === 'NEEDS_INPUT') t.needsInput++;
    else if (it.answer.status === 'NEEDS_GENERATION') t.needsGeneration++;
    else if (it.answer.status === 'OPTIONAL_BLANK') t.optionalBlank++;
  }
  return t;
}

function computeStatus(
  inspect: { supported: boolean; loginRequired: boolean; captcha: boolean },
  items: PreparedItem[],
): ApplicationStatus {
  if (inspect.loginRequired) return 'LOGIN_REQUIRED';
  if (inspect.captcha) return 'CAPTCHA';
  if (!inspect.supported) return 'MANUAL_REVIEW';
  const blocked = items.some(
    (it) => it.question.required && (it.answer.status === 'NEEDS_INPUT' || it.answer.status === 'NEEDS_GENERATION' || it.answer.status === 'UNSUPPORTED'),
  );
  return blocked ? 'NEEDS_USER_INPUT' : 'READY_FOR_APPROVAL';
}

async function driveTo(db: Database, applicationId: string, from: ApplicationStatus, to: ApplicationStatus, note: string): Promise<void> {
  const path = shortestPath(from, to);
  if (!path) return;
  let prev = from;
  for (const hop of path) {
    await applicationsRepo.transitionStatus(db, applicationId, hop, { metadata: { phase: 'prep', note } });
    prev = hop;
  }
  void prev;
}

async function firstSourceName(db: Database, jobId: string): Promise<string> {
  const sources = await jobSourcesRepo.listSourcesForJob(db, jobId);
  return sources[0]?.sourceName ?? 'unknown';
}

/**
 * Prepare (or return the existing) application for one job. Read-only external access;
 * NEVER submits. Idempotent: if an application already exists it is returned as-is.
 */
export async function prepareApplication(
  db: Database,
  jobId: string,
  opts: { fetcher?: Fetcher } = {},
): Promise<PrepSummary> {
  const fetcher = opts.fetcher ?? httpFetcher;
  const user = await usersRepo.getFirstUser(db) ?? (await usersRepo.createUser(db, { displayName: 'Local User' }));
  const job = await jobsRepo.getJob(db, jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const existing = await applicationsRepo.getApplicationForUserJob(db, user.id, jobId);
  const ctx = await buildContext(db, job);
  const sourceName = await firstSourceName(db, jobId);

  const resolved = await resolveApplyUrl(job.canonicalUrl, sourceName, fetcher);
  const inspect = await inspectDestination(resolved, fetcher);
  const items = buildItems(inspect, ctx);
  const targetStatus = computeStatus(inspect, items);
  const resumeStatus = ctx.resumeAvailable ? 'READY' : 'MISSING';

  // Create (or reuse) the application.
  let app = existing;
  if (!app) app = await applicationsRepo.createApplication(db, user.id, jobId);
  const appId = app.id;

  await eventsRepo.recordEvent(db, { applicationId: appId, eventType: 'PROVIDER_DETECTED', metadata: { provider: inspect.provider, applyUrl: inspect.applyUrl, gated: resolved.gated } });
  await eventsRepo.recordEvent(db, { applicationId: appId, eventType: 'FORM_INSPECTED', metadata: { supported: inspect.supported, questionCount: items.length } });

  await prepRepo.replacePreparedForm(db, appId, items);
  await prepRepo.setApplicationPrep(db, appId, {
    provider: inspect.provider,
    applyUrl: inspect.applyUrl,
    formUnderstood: inspect.supported,
    resumeStatus,
    preparationNote: inspect.note,
  });

  const current = (await applicationsRepo.getApplication(db, appId))!.status;
  await driveTo(db, appId, current, targetStatus, inspect.note ?? '');
  await eventsRepo.recordEvent(db, { applicationId: appId, eventType: 'PREPARATION_VALIDATED', metadata: { status: targetStatus, ...tally(items) } });

  return {
    jobId, company: job.companyName, title: job.title, applicationId: appId,
    provider: inspect.provider, applyUrl: inspect.applyUrl, supported: inspect.supported,
    gated: resolved.gated, status: targetStatus, questionCount: items.length,
    answers: tally(items), resumeStatus, note: inspect.note,
  };
}

/** Eligible jobs (for the local user) that do not yet have an application. */
async function eligibleUnprepared(db: Database) {
  const user = await usersRepo.getFirstUser(db);
  if (!user) return [] as { job: Job }[];
  const matches = await matchesRepo.listMatchesWithJobsByEligibility(db, user.id, ['ELIGIBLE']);
  const out: { job: Job }[] = [];
  for (const m of matches) {
    const existing = await applicationsRepo.getApplicationForUserJob(db, user.id, m.job.id);
    if (!existing) out.push({ job: m.job });
  }
  return out;
}

export interface DryRunReport {
  considered: number;
  wouldCreate: number;
  byProvider: Record<string, number>;
  supported: number;
  unsupported: number;
  gated: number;
  rows: { company: string | null; title: string | null; provider: string; supported: boolean; gated: boolean; applyUrl: string }[];
}

/** Dry-run: resolve+inspect eligible jobs read-only. NO DB writes, NO form mutations. */
export async function dryRunEligible(db: Database, opts: { fetcher?: Fetcher; limit?: number } = {}): Promise<DryRunReport> {
  const fetcher = opts.fetcher ?? httpFetcher;
  const jobs = (await eligibleUnprepared(db)).slice(0, opts.limit ?? 100);
  const report: DryRunReport = { considered: jobs.length, wouldCreate: jobs.length, byProvider: {}, supported: 0, unsupported: 0, gated: 0, rows: [] };
  for (const { job } of jobs) {
    const sourceName = await firstSourceName(db, job.id);
    const resolved = await resolveApplyUrl(job.canonicalUrl, sourceName, fetcher);
    const inspect = await inspectDestination(resolved, fetcher);
    report.byProvider[inspect.provider] = (report.byProvider[inspect.provider] ?? 0) + 1;
    if (inspect.supported) report.supported++; else report.unsupported++;
    if (resolved.gated) report.gated++;
    report.rows.push({ company: job.companyName, title: job.title, provider: inspect.provider, supported: inspect.supported, gated: resolved.gated, applyUrl: inspect.applyUrl });
  }
  return report;
}

/** Prepare all eligible-unprepared jobs (optionally limited). */
export async function prepareEligible(db: Database, opts: { fetcher?: Fetcher; limit?: number } = {}): Promise<PrepSummary[]> {
  const jobs = (await eligibleUnprepared(db)).slice(0, opts.limit ?? 100);
  const out: PrepSummary[] = [];
  for (const { job } of jobs) out.push(await prepareApplication(db, job.id, { fetcher: opts.fetcher }));
  return out;
}

/** Recompute an application's status after its answers change (supported forms only). */
async function revalidate(db: Database, applicationId: string): Promise<void> {
  const app = await applicationsRepo.getApplication(db, applicationId);
  if (!app || !app.formUnderstood) return; // unsupported forms stay MANUAL_REVIEW
  const form = await prepRepo.getPreparedForm(db, applicationId);
  const blocked = form.some(
    (r) => r.question.required && (r.answer.status === 'NEEDS_INPUT' || r.answer.status === 'NEEDS_GENERATION' || r.answer.status === 'UNSUPPORTED'),
  );
  const target: ApplicationStatus = blocked ? 'NEEDS_USER_INPUT' : 'READY_FOR_APPROVAL';
  if (target !== app.status) {
    await driveTo(db, applicationId, app.status, target, 'revalidate');
    await eventsRepo.recordEvent(db, { applicationId, eventType: 'PREPARATION_VALIDATED', metadata: { status: target } });
  }
}

/**
 * Persist a user's answer to one question, record it, optionally save it as a
 * reusable approved answer, and revalidate the application. Never submits.
 */
export async function applyUserAnswer(
  db: Database,
  questionId: string,
  value: string,
  opts: { reusable?: boolean } = {},
): Promise<void> {
  const question = await prepRepo.getQuestion(db, questionId);
  if (!question) throw new Error(`Question not found: ${questionId}`);
  await prepRepo.setUserAnswer(db, questionId, value);
  await eventsRepo.recordEvent(db, {
    applicationId: question.applicationId,
    eventType: 'USER_ANSWERED',
    metadata: { category: question.category, label: question.label },
  });
  if (opts.reusable) {
    const user = await usersRepo.getFirstUser(db);
    if (user) {
      const label = question.category === 'TECH_YEARS' ? namedTech(question.label.toLowerCase()) : null;
      await prepRepo.saveReusableAnswer(db, user.id, question.category, label, value);
    }
  }
  await revalidate(db, question.applicationId);
}

/**
 * Approve a prepared application for review. This ONLY marks the local preparation as
 * reviewed/approved and counts it toward the supervised calibration — it performs NO
 * network submission to the employer.
 */
export async function approvePreparation(db: Database, applicationId: string): Promise<void> {
  const app = await applicationsRepo.getApplication(db, applicationId);
  if (!app) throw new Error(`Application not found: ${applicationId}`);
  if (app.status !== 'READY_FOR_APPROVAL') {
    throw new Error(`Application is ${app.status}; only READY_FOR_APPROVAL can be approved.`);
  }
  const form = await prepRepo.getPreparedForm(db, applicationId);
  for (const r of form) await prepRepo.markAnswerApproved(db, r.answer.id, true);
  await eventsRepo.recordEvent(db, { applicationId, eventType: 'PREPARATION_APPROVED', metadata: { note: 'Local approval only — not submitted.' } });
  await automationRepo.incrementReviewedCount(db, app.userId); // supervised calibration
}
