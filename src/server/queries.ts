import { sql, type SQL } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import {
  usersRepo, jobsRepo, jobSourcesRepo, matchesRepo,
  applicationsRepo, eventsRepo, reviewsRepo, prepRepo,
} from '../repositories/index.js';
import { hasLlmCredential } from '../analysis/anthropicAnalyzer.js';
import type { FitAnalysis } from '../analysis/types.js';
import type {
  AppDetail, AppListItem, DashboardData, JobDetail, JobListItem, ReviewView,
} from './types.js';

/** Review types that are non-blocking ambiguity (never shown in the blocking queue). */
const NON_BLOCKING_TYPES = ['AMBIGUOUS_ELIGIBILITY', 'SALARY_QUESTION', 'OTHER'];
const ATTENTION_STATUSES = [
  'READY_FOR_APPROVAL', 'NEEDS_USER_INPUT', 'MANUAL_REVIEW',
  'LOGIN_REQUIRED', 'CAPTCHA', 'AUTOMATION_FAILED',
];

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString() : null;
}
function stripHtml(html: string | null): string {
  if (!html) return '';
  return html
    .replace(/<\s*(br|\/p|\/li|\/div)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&#\d+;/g, ' ')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

interface RawJobRow {
  id: string; company_name: string | null; title: string | null; location_text: string | null;
  remote_type: string; salary_min: string | null; salary_max: string | null;
  salary_currency: string | null; salary_period: string | null;
  date_posted: Date | null; first_discovered_at: Date | null;
  eligibility_status: string | null; eligibility_reason: string | null;
  fit_score: number | null; fit_status: string | null;
  evaluation_details: { priority?: boolean; reasons?: { code: string; kind: string }[] } | null;
  application_status: string | null; sources: string[] | null;
}

function toJobListItem(r: RawJobRow): JobListItem {
  const reviewReasons = (r.evaluation_details?.reasons ?? []).filter((x) => x.kind === 'review');
  return {
    id: r.id,
    company: r.company_name,
    title: r.title,
    location: r.location_text,
    remoteType: r.remote_type,
    salary: { min: r.salary_min, max: r.salary_max, currency: r.salary_currency, period: r.salary_period },
    datePosted: iso(r.date_posted),
    firstDiscoveredAt: iso(r.first_discovered_at),
    sources: r.sources ?? [],
    eligibilityStatus: r.eligibility_status as JobListItem['eligibilityStatus'],
    eligibilityReason: r.eligibility_reason,
    fitScore: r.fit_score,
    fitStatus: r.fit_status as JobListItem['fitStatus'],
    priority: Boolean(r.evaluation_details?.priority),
    uncertainties: reviewReasons.map((x) => x.code),
    applicationStatus: r.application_status as JobListItem['applicationStatus'],
  };
}

const JOB_SELECT = (userId: string): SQL => sql`
  select j.id, j.company_name, j.title, j.location_text, j.remote_type,
         j.salary_min, j.salary_max, j.salary_currency, j.salary_period,
         j.date_posted, j.first_discovered_at,
         m.eligibility_status, m.eligibility_reason, m.fit_score, m.fit_status, m.evaluation_details,
         a.status as application_status,
         (select array_agg(distinct s.source_name) from job_sources s where s.job_id = j.id) as sources
  from jobs j
  left join job_matches m on m.job_id = j.id and m.user_id = ${userId}
  left join applications a on a.job_id = j.id and a.user_id = ${userId}`;

export interface JobFilters {
  eligibility?: string; fit?: string; source?: string; freshness?: string;
  appStatus?: string; q?: string; sort?: string; limit?: number; offset?: number;
}

function jobConditions(f: JobFilters): SQL[] {
  const c: SQL[] = [];
  if (f.eligibility) c.push(sql`m.eligibility_status = ${f.eligibility}`);
  else c.push(sql`(m.eligibility_status is null or m.eligibility_status <> 'INELIGIBLE')`); // default: hide rejects
  if (f.fit === 'NOT_ANALYZED') c.push(sql`m.fit_score is null`);
  else if (f.fit) c.push(sql`m.fit_status = ${f.fit}`);
  if (f.appStatus) c.push(sql`a.status = ${f.appStatus}`);
  if (f.freshness === '72h') c.push(sql`j.date_posted >= now() - interval '72 hours'`);
  else if (f.freshness === '14d') c.push(sql`j.date_posted >= now() - interval '14 days'`);
  if (f.source) c.push(sql`exists (select 1 from job_sources s where s.job_id = j.id and s.source_name = ${f.source})`);
  if (f.q) c.push(sql`(j.company_name ilike ${'%' + f.q + '%'} or j.title ilike ${'%' + f.q + '%'})`);
  return c;
}
function jobOrder(sort: string | undefined): SQL {
  switch (sort) {
    case 'newest': return sql`j.date_posted desc nulls last`;
    case 'oldest': return sql`j.date_posted asc nulls last`;
    case 'company': return sql`j.company_name asc nulls last`;
    default: return sql`m.fit_score desc nulls last, j.date_posted desc nulls last`; // 'fit'
  }
}

export async function listJobs(
  db: Database, f: JobFilters,
): Promise<{ items: JobListItem[]; total: number }> {
  const user = await usersRepo.getFirstUser(db);
  if (!user) return { items: [], total: 0 };
  const conds = jobConditions(f);
  const where = conds.length ? sql` where ${sql.join(conds, sql` and `)}` : sql``;
  const limit = Math.min(f.limit ?? 50, 200);
  const offset = f.offset ?? 0;

  const rows = await db.execute(
    sql`${JOB_SELECT(user.id)}${where} order by ${jobOrder(f.sort)} limit ${limit} offset ${offset}`,
  );
  const totalRes = await db.execute(
    sql`select count(*)::int as c from jobs j
        left join job_matches m on m.job_id = j.id and m.user_id = ${user.id}
        left join applications a on a.job_id = j.id and a.user_id = ${user.id}${where}`,
  );
  return {
    items: (rows.rows as unknown as RawJobRow[]).map(toJobListItem),
    total: (totalRes.rows[0] as { c: number } | undefined)?.c ?? 0,
  };
}

export async function getJobDetail(db: Database, id: string): Promise<JobDetail | null> {
  const job = await jobsRepo.getJob(db, id);
  if (!job) return null;
  const user = await usersRepo.getFirstUser(db);
  const match = user ? await matchesRepo.getMatch(db, user.id, job.id) : null;
  const application = user ? await applicationsRepo.getApplicationForUserJob(db, user.id, job.id) : null;
  const sources = await jobSourcesRepo.listSourcesForJob(db, job.id);
  const fa = (match?.fitAnalysis as FitAnalysis | null) ?? null;
  const details = (match?.evaluationDetails as { reasons?: { code: string; kind: string; message: string }[] } | null) ?? null;

  return {
    id: job.id, company: job.companyName, title: job.title, location: job.locationText,
    remoteType: job.remoteType, employmentType: job.employmentType,
    salary: { min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency, period: job.salaryPeriod },
    datePosted: iso(job.datePosted), firstDiscoveredAt: iso(job.firstDiscoveredAt), lastSeenAt: iso(job.lastSeenAt),
    canonicalUrl: job.canonicalUrl, descriptionText: stripHtml(job.description),
    sources: sources.map((s) => ({ sourceName: s.sourceName, sourceJobId: s.sourceJobId, sourceUrl: s.sourceUrl, discoveredAt: iso(s.discoveredAt) })),
    eligibility: { status: match?.eligibilityStatus ?? null, reason: match?.eligibilityReason ?? null, reasons: details?.reasons ?? [] },
    fit: fa ? {
      score: fa.fit_score, status: fa.fit_status, confidence: fa.confidence, summary: fa.summary,
      components: {
        role_alignment: fa.role_alignment, technical_match: fa.technical_match,
        experience_match: fa.experience_match, responsibility_match: fa.responsibility_match,
      },
      matching_requirements: fa.matching_requirements, missing_requirements: fa.missing_requirements,
      preferred_skill_gaps: fa.preferred_skill_gaps, hard_requirement_concerns: fa.hard_requirement_concerns,
      uncertainties: fa.uncertainties, model: fa.meta?.model ?? null, analyzedAt: fa.meta?.analyzedAt ?? null,
    } : null,
    applicationStatus: (application?.status as JobDetail['applicationStatus']) ?? null,
    applicationId: application?.id ?? null,
  };
}

function isSwiss(location: string | null): boolean {
  return /switzerland|schweiz|suisse|svizzera|zurich|zürich|geneva|genève|basel|bern|lausanne|lugano|ticino/i.test(location ?? '');
}

export async function listApplications(db: Database, statusFilter?: string): Promise<AppListItem[]> {
  const user = await usersRepo.getFirstUser(db);
  if (!user) return [];
  const rows = await db.execute(sql`
    select a.id, a.job_id, a.status, a.created_at, a.updated_at, a.provider, a.resume_status,
           j.company_name, j.title, j.location_text,
           m.fit_score, m.fit_status,
           (select count(*)::int from application_answers aa
              join application_questions aq on aq.id = aa.question_id
              where aa.application_id = a.id and aq.required
                and aa.status in ('NEEDS_INPUT','NEEDS_GENERATION','UNSUPPORTED')) as unanswered_required
    from applications a
    join jobs j on j.id = a.job_id
    left join job_matches m on m.job_id = a.job_id and m.user_id = a.user_id
    where a.user_id = ${user.id}${statusFilter ? sql` and a.status = ${statusFilter}` : sql``}
    order by a.updated_at desc`);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: r['id'] as string, jobId: r['job_id'] as string,
    company: (r['company_name'] as string) ?? null, title: (r['title'] as string) ?? null,
    status: r['status'] as AppListItem['status'],
    fitScore: (r['fit_score'] as number) ?? null, fitStatus: (r['fit_status'] as AppListItem['fitStatus']) ?? null,
    provider: (r['provider'] as string) ?? null, resumeStatus: (r['resume_status'] as string) ?? null,
    unansweredRequired: (r['unanswered_required'] as number) ?? 0,
    swiss: isSwiss(r['location_text'] as string),
    needsAttention: ATTENTION_STATUSES.includes(r['status'] as string),
    createdAt: iso(r['created_at'] as Date) ?? '', updatedAt: iso(r['updated_at'] as Date) ?? '',
  }));
}

export async function getApplicationDetail(db: Database, id: string): Promise<AppDetail | null> {
  const app = await applicationsRepo.getApplication(db, id);
  if (!app) return null;
  const job = await jobsRepo.getJob(db, app.jobId);
  const user = await usersRepo.getFirstUser(db);
  const match = user ? await matchesRepo.getMatch(db, user.id, app.jobId) : null;
  const events = await eventsRepo.getApplicationHistory(db, app.id);
  const form = await prepRepo.getPreparedForm(db, app.id);
  return {
    id: app.id, jobId: app.jobId, company: job?.companyName ?? null, title: job?.title ?? null,
    status: app.status, attemptCount: app.attemptCount, requiresUserInput: app.requiresUserInput,
    userInputReason: app.userInputReason, failureCategory: app.failureCategory, failureDetails: app.failureDetails,
    currentStep: app.currentStep, submittedAt: iso(app.submittedAt),
    createdAt: iso(app.createdAt) ?? '', updatedAt: iso(app.updatedAt) ?? '',
    canonicalUrl: job?.canonicalUrl ?? '',
    fit: { score: match?.fitScore ?? null, status: (match?.fitStatus as AppDetail['fit']['status']) ?? null },
    events: events.map((e) => ({
      id: e.id, eventType: e.eventType, fromStatus: e.fromStatus, toStatus: e.toStatus,
      metadata: e.metadata, createdAt: iso(e.createdAt) ?? '',
    })),
    provider: app.provider ?? null, applyUrl: app.applyUrl ?? null,
    formUnderstood: app.formUnderstood, resumeStatus: app.resumeStatus ?? null,
    preparationNote: app.preparationNote ?? null,
    questions: form.map((r) => ({
      questionId: r.question.id, providerFieldId: r.question.providerFieldId,
      label: r.question.label, category: r.question.category,
      fieldType: r.question.fieldType, required: r.question.required,
      options: (r.question.options as string[] | null) ?? null, sourceKind: r.question.sourceKind,
      answer: {
        value: r.answer.value, source: r.answer.answerSource, status: r.answer.status,
        confidence: r.answer.confidence, approved: r.answer.approved, reusable: r.answer.reusable,
      },
    })),
  };
}

async function reviewToView(db: Database, r: Awaited<ReturnType<typeof reviewsRepo.listUnresolvedReviews>>[number]): Promise<ReviewView> {
  const job = r.jobId ? await jobsRepo.getJob(db, r.jobId) : null;
  return {
    id: r.id, reviewType: r.reviewType, status: r.status, reason: r.reason,
    jobId: r.jobId, jobTitle: job?.title ?? null, company: job?.companyName ?? null,
    applicationId: r.applicationId, createdAt: iso(r.createdAt) ?? '',
    note: (r.payload as { humanNote?: string } | null)?.humanNote ?? null,
  };
}

/** Blocking reviews only = OPEN review items that are not non-blocking ambiguity types. */
export async function listBlockingReviews(db: Database): Promise<ReviewView[]> {
  const user = await usersRepo.getFirstUser(db);
  if (!user) return [];
  const open = await reviewsRepo.listUnresolvedReviews(db, user.id);
  const blocking = open.filter((r) => !NON_BLOCKING_TYPES.includes(r.reviewType));
  return Promise.all(blocking.map((r) => reviewToView(db, r)));
}

export async function resolveReview(db: Database, id: string, decision: 'RESOLVED' | 'DISMISSED', note?: string) {
  return reviewsRepo.resolveReviewItem(db, id, decision, note ?? null);
}

export async function getDashboard(db: Database): Promise<DashboardData> {
  const user = await usersRepo.getFirstUser(db);
  const meta = { llmConfigured: hasLlmCredential(), hasUser: Boolean(user) };
  if (!user) {
    return {
      counts: { jobsDiscovered: 0, eligible: 0, needsReview: 0, rejected: 0, fitAnalyzed: 0, strongMatches: 0, awaitingAnalysis: 0, applicationsTotal: 0, appsByStatus: {} },
      bestMatches: [], recentDiscoveries: [], needsAttention: { reviews: [], applications: [] }, meta,
    };
  }

  const countsRes = await db.execute(sql`
    select
      count(*)::int as jobs_discovered,
      count(*) filter (where m.eligibility_status='ELIGIBLE')::int as eligible,
      count(*) filter (where m.eligibility_status='AMBIGUOUS')::int as needs_review,
      count(*) filter (where m.eligibility_status='INELIGIBLE')::int as rejected,
      count(*) filter (where m.fit_score is not null)::int as fit_analyzed,
      count(*) filter (where m.fit_status='STRONG')::int as strong_matches,
      count(*) filter (where m.eligibility_status in ('ELIGIBLE','AMBIGUOUS') and m.fit_score is null)::int as awaiting
    from jobs j left join job_matches m on m.job_id=j.id and m.user_id=${user.id}`);
  const c = countsRes.rows[0] as Record<string, number>;

  const appStatusRes = await db.execute(sql`select status, count(*)::int as c from applications where user_id=${user.id} group by status`);
  const appsByStatus: Record<string, number> = {};
  for (const row of appStatusRes.rows as { status: string; c: number }[]) appsByStatus[row.status] = row.c;
  const applicationsTotal = Object.values(appsByStatus).reduce((a, b) => a + b, 0);

  const best = await listJobs(db, { fit: undefined, sort: 'fit', limit: 5, eligibility: undefined });
  const bestMatches = best.items.filter((j) => j.fitScore != null).slice(0, 5);
  const recent = await listJobs(db, { sort: 'newest', limit: 8 });

  const reviews = await listBlockingReviews(db);
  const apps = await listApplications(db);
  const attentionApps = apps.filter((a) => a.needsAttention);

  return {
    counts: {
      jobsDiscovered: c['jobs_discovered'] ?? 0, eligible: c['eligible'] ?? 0, needsReview: c['needs_review'] ?? 0,
      rejected: c['rejected'] ?? 0, fitAnalyzed: c['fit_analyzed'] ?? 0, strongMatches: c['strong_matches'] ?? 0,
      awaitingAnalysis: c['awaiting'] ?? 0, applicationsTotal, appsByStatus,
    },
    bestMatches, recentDiscoveries: recent.items, needsAttention: { reviews, applications: attentionApps }, meta,
  };
}

export async function listSources(db: Database): Promise<string[]> {
  const res = await db.execute(sql`select distinct source_name from job_sources order by source_name`);
  return (res.rows as { source_name: string }[]).map((r) => r.source_name);
}
