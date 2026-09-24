import { sql } from 'drizzle-orm';
import { createAppDb, type Database } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemo } from '../seed/demo.js';
import {
  usersRepo,
  automationRepo,
  jobsRepo,
  jobSourcesRepo,
  matchesRepo,
  applicationsRepo,
  eventsRepo,
  reviewsRepo,
} from '../repositories/index.js';
import { runDiscovery } from '../pipeline/discover.js';
import type { MatchWithJob } from '../repositories/jobMatches.js';
import { isEntrypoint } from '../util/entrypoint.js';

/**
 * Developer inspection/testing CLI. NOT the product UI. Deterministic, no LLM.
 * Usage: npm run cli -- <command> [args]
 */
const USAGE = `ApplyPilot dev CLI

  discover           Fetch real jobs from sources, store, dedup, run eligibility
  shortlist          Show ELIGIBLE jobs (priority <=72h, then newest)
  rejected           Show INELIGIBLE jobs with reasons
  review             Show jobs needing human review (ambiguous)
  job <id>           Show one job, its sources, and its match result
  db                 Show connection + row counts per table
  migrate            Apply pending migrations
  seed               Run the deterministic demo seed
  user               Show the local user and automation state
  jobs               List jobs (global)
  matches            List job matches for the local user
  applications       List applications for the local user
  application <id>   Show one application + its event history
  reviews            List unresolved (OPEN) review items
`;

/** Sort qualified/review rows: priority (<=72h) first, then newest posted. */
function sortForShortlist(rows: MatchWithJob[]): MatchWithJob[] {
  const priorityOf = (r: MatchWithJob): number => {
    const d = (r.match.evaluationDetails as { priority?: boolean } | null)?.priority;
    return d ? 1 : 0;
  };
  const postedMs = (r: MatchWithJob): number => r.job.datePosted?.getTime() ?? 0;
  return [...rows].sort(
    (a, b) => priorityOf(b) - priorityOf(a) || postedMs(b) - postedMs(a),
  );
}

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : 'n/a';
}

function fmtSalary(job: MatchWithJob['job']): string {
  if (!job.salaryMin && !job.salaryMax) return 'n/a';
  return `${job.salaryMin ?? '?'}-${job.salaryMax ?? '?'} ${job.salaryCurrency ?? ''}/${job.salaryPeriod ?? ''}`;
}

async function printJobRow(db: Database, r: MatchWithJob): Promise<void> {
  const sources = await jobSourcesRepo.listSourcesForJob(db, r.job.id);
  const srcNames = [...new Set(sources.map((s) => s.sourceName))].join(',') || '-';
  const priority = (r.match.evaluationDetails as { priority?: boolean } | null)?.priority;
  const flag = priority ? '⚡' : '  ';
  console.log(
    `${flag}[${r.job.id.slice(0, 8)}] ${r.job.title ?? '(no title)'} @ ${r.job.companyName ?? '(no company)'}`,
  );
  console.log(
    `      ${r.job.remoteType} | ${r.job.locationText ?? '-'} | posted ${fmtDate(r.job.datePosted)} | ${fmtSalary(r.job)} | src=${srcNames}`,
  );
  console.log(`      elig=${r.match.eligibilityStatus} reason=${r.match.eligibilityReason ?? '-'}`);
  console.log(`      ${r.job.canonicalUrl}`);
}

async function cmdDiscover(db: Database): Promise<void> {
  console.log('Running discovery (real sources)…');
  const s = await runDiscovery(db);
  console.log('\n=== Discovery summary ===');
  for (const [name, n] of Object.entries(s.perSource)) console.log(`  source ${name.padEnd(12)} fetched ${n}`);
  for (const e of s.sourceErrors) console.log(`  source ${e.source} ERROR: ${e.error}`);
  console.log(`  Discovered:   ${s.discovered}`);
  console.log(`  New:          ${s.newJobs}`);
  console.log(`  Existing:     ${s.existingJobs}`);
  console.log(`  Duplicates:   ${s.duplicates} (same posting via multiple sources this run)`);
  console.log(`  Eligible:     ${s.eligible}`);
  console.log(`  Rejected:     ${s.rejected}`);
  console.log(`  Needs review: ${s.needsReview}`);
  console.log(`  Review items created: ${s.reviewItemsCreated}`);
  if (Object.keys(s.rejectionReasons).length) {
    console.log('  Top rejection reasons:');
    for (const [c, n] of Object.entries(s.rejectionReasons).sort((a, b) => b[1] - a[1]))
      console.log(`    ${c.padEnd(28)} ${n}`);
  }
  if (Object.keys(s.reviewReasons).length) {
    console.log('  Review reasons:');
    for (const [c, n] of Object.entries(s.reviewReasons).sort((a, b) => b[1] - a[1]))
      console.log(`    ${c.padEnd(28)} ${n}`);
  }
  console.log('\nInspect with: npm run shortlist   (also: cli review, cli rejected)');
}

async function cmdShortlist(db: Database, limitArg?: string): Promise<void> {
  const userId = await requireUserId(db);
  const limit = limitArg ? Number(limitArg) : 25;
  const rows = sortForShortlist(await matchesRepo.listMatchesWithJobs(db, userId, ['QUALIFIED']));
  if (rows.length === 0) return console.log('Shortlist empty. Run: npm run discover');
  console.log(`Shortlist — ${rows.length} eligible (showing ${Math.min(limit, rows.length)}; ⚡=posted <=72h):\n`);
  for (const r of rows.slice(0, limit)) await printJobRow(db, r);
}

async function cmdRejected(db: Database): Promise<void> {
  const userId = await requireUserId(db);
  const rows = await matchesRepo.listMatchesWithJobs(db, userId, ['REJECTED']);
  if (rows.length === 0) return console.log('No rejected jobs.');
  const byReason: Record<string, number> = {};
  for (const r of rows) {
    const key = r.match.eligibilityReason ?? 'UNKNOWN';
    byReason[key] = (byReason[key] ?? 0) + 1;
  }
  console.log(`Rejected: ${rows.length}. By reason:`);
  for (const [k, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(k).padEnd(34)} ${n}`);
  console.log('\nSamples:');
  for (const r of rows.slice(0, 10)) {
    console.log(`  [${r.job.id.slice(0, 8)}] ${r.job.title ?? '?'} @ ${r.job.companyName ?? '?'} — ${r.match.eligibilityReason}`);
  }
}

async function cmdReview(db: Database): Promise<void> {
  const userId = await requireUserId(db);
  const rows = sortForShortlist(await matchesRepo.listMatchesWithJobs(db, userId, ['PENDING']));
  if (rows.length === 0) return console.log('Nothing needs review.');
  console.log(`Needs review — ${rows.length}:\n`);
  for (const r of rows.slice(0, 25)) await printJobRow(db, r);
}

async function cmdJob(db: Database, id: string): Promise<void> {
  // Accept a full or short (first 8 chars) id.
  const jobs = await jobsRepo.listJobs(db, 1000);
  const job = jobs.find((j) => j.id === id || j.id.startsWith(id));
  if (!job) return console.log(`Job not found: ${id}`);
  console.log('Job:');
  console.log(`  id           ${job.id}`);
  console.log(`  title        ${job.title ?? '-'}`);
  console.log(`  company      ${job.companyName ?? '-'}`);
  console.log(`  remote       ${job.remoteType}`);
  console.log(`  location     ${job.locationText ?? '-'}`);
  console.log(`  salary       ${job.salaryMin ?? '?'}-${job.salaryMax ?? '?'} ${job.salaryCurrency ?? ''} ${job.salaryPeriod ?? ''}`);
  console.log(`  posted       ${fmtDate(job.datePosted)}`);
  console.log(`  url          ${job.canonicalUrl}`);
  const sources = await jobSourcesRepo.listSourcesForJob(db, job.id);
  console.log(`Sources (${sources.length}):`);
  for (const s of sources) console.log(`  ${s.sourceName} id=${s.sourceJobId ?? '-'} ${s.sourceUrl}`);
  const user = await usersRepo.getFirstUser(db);
  if (user) {
    const match = await matchesRepo.getMatch(db, user.id, job.id);
    if (match) {
      console.log('Match:');
      console.log(`  status       ${match.status}`);
      console.log(`  eligibility  ${match.eligibilityStatus}`);
      console.log(`  reason       ${match.eligibilityReason ?? '-'}`);
      const details = match.evaluationDetails as { reasons?: { code: string; message: string }[] } | null;
      for (const rr of details?.reasons ?? []) console.log(`   - ${rr.code}: ${rr.message}`);
    }
  }
}

async function requireUserId(db: Database): Promise<string> {
  const user = await usersRepo.getFirstUser(db);
  if (!user) {
    throw new Error('No data yet. Run: npm run discover  (or npm run db:seed for the demo)');
  }
  return user.id;
}

async function cmdDb(db: Database): Promise<void> {
  const tables = [
    'users',
    'user_automation_settings',
    'jobs',
    'job_sources',
    'job_matches',
    'applications',
    'application_events',
    'review_items',
  ];
  console.log('Database connection OK. Row counts:');
  for (const t of tables) {
    // Table names come from the fixed whitelist above, so raw interpolation is safe.
    const result = await db.execute(sql.raw(`select count(*)::int as c from ${t}`));
    const count = (result.rows[0] as { c: number } | undefined)?.c ?? 0;
    console.log(`  ${t.padEnd(26)} ${count}`);
  }
}

async function cmdUser(db: Database): Promise<void> {
  const user = await usersRepo.getFirstUser(db);
  if (!user) return console.log('No user. Run: npm run db:seed');
  const settings = await automationRepo.getSettings(db, user.id);
  console.log('User:');
  console.log(`  id            ${user.id}`);
  console.log(`  display_name  ${user.displayName ?? '(none)'}`);
  console.log('Automation settings:');
  console.log(`  enabled            ${settings?.automationEnabled}`);
  console.log(`  review_count       ${settings?.initialReviewCount}`);
  console.log(`  review_target      ${settings?.initialReviewTarget}`);
  console.log(`  approval_status    ${settings?.automationApprovalStatus}`);
}

async function cmdJobs(db: Database): Promise<void> {
  const jobs = await jobsRepo.listJobs(db);
  if (jobs.length === 0) return console.log('No jobs.');
  console.log(`Jobs (${jobs.length}):`);
  for (const j of jobs) {
    const salary =
      j.salaryMin || j.salaryMax
        ? `${j.salaryMin ?? '?'}-${j.salaryMax ?? '?'} ${j.salaryCurrency ?? ''}/${j.salaryPeriod ?? ''}`
        : 'n/a';
    console.log(
      `  [${j.id.slice(0, 8)}] ${j.title ?? '(no title)'} @ ${j.companyName ?? '(no company)'}`,
    );
    console.log(`            ${j.remoteType} | ${j.locationText ?? '-'} | ${salary}`);
  }
}

async function cmdMatches(db: Database): Promise<void> {
  const userId = await requireUserId(db);
  const matches = await matchesRepo.listMatchesForUser(db, userId);
  if (matches.length === 0) return console.log('No matches.');
  console.log(`Matches for user ${userId.slice(0, 8)} (${matches.length}):`);
  for (const m of matches) {
    console.log(
      `  [${m.id.slice(0, 8)}] job ${m.jobId.slice(0, 8)} | ${m.status} | elig=${m.eligibilityStatus} | fit=${m.fitStatus}${m.fitScore != null ? `(${m.fitScore})` : ''}`,
    );
    if (m.eligibilityReason) console.log(`            elig: ${m.eligibilityReason}`);
  }
}

async function cmdApplications(db: Database): Promise<void> {
  const userId = await requireUserId(db);
  const apps = await applicationsRepo.listApplicationsForUser(db, userId);
  if (apps.length === 0) return console.log('No applications.');
  console.log(`Applications for user ${userId.slice(0, 8)} (${apps.length}):`);
  for (const a of apps) {
    console.log(
      `  [${a.id.slice(0, 8)}] job ${a.jobId.slice(0, 8)} | ${a.status} | attempts=${a.attemptCount}`,
    );
  }
}

async function cmdApplication(db: Database, id: string): Promise<void> {
  const app = await applicationsRepo.getApplication(db, id);
  if (!app) return console.log(`Application not found: ${id}`);
  console.log('Application:');
  console.log(`  id             ${app.id}`);
  console.log(`  status         ${app.status}`);
  console.log(`  attempt_count  ${app.attemptCount}`);
  console.log(`  submitted_at   ${app.submittedAt?.toISOString() ?? '(not submitted)'}`);
  if (app.failureCategory)
    console.log(`  failure        ${app.failureCategory}: ${app.failureDetails ?? ''}`);
  const history = await eventsRepo.getApplicationHistory(db, app.id);
  console.log(`Event history (${history.length}):`);
  for (const e of history) {
    const transition =
      e.fromStatus || e.toStatus ? ` ${e.fromStatus ?? '·'} -> ${e.toStatus ?? '·'}` : '';
    console.log(`  ${e.createdAt.toISOString()}  ${e.eventType}${transition}`);
  }
}

async function cmdReviews(db: Database): Promise<void> {
  const userId = await requireUserId(db);
  const reviews = await reviewsRepo.listUnresolvedReviews(db, userId);
  if (reviews.length === 0) return console.log('No open review items.');
  console.log(`Open review items (${reviews.length}):`);
  for (const r of reviews) {
    console.log(`  [${r.id.slice(0, 8)}] ${r.reviewType} | ${r.status}`);
    if (r.reason) console.log(`            ${r.reason}`);
  }
}

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);
  const handle = createAppDb();
  try {
    switch (command) {
      case 'discover':
        await cmdDiscover(handle.db);
        break;
      case 'shortlist':
        await cmdShortlist(handle.db, arg);
        break;
      case 'rejected':
        await cmdRejected(handle.db);
        break;
      case 'review':
        await cmdReview(handle.db);
        break;
      case 'job':
        if (!arg) throw new Error('Usage: cli job <id>');
        await cmdJob(handle.db, arg);
        break;
      case 'db':
        await cmdDb(handle.db);
        break;
      case 'migrate':
        await runMigrations(handle.db);
        console.log('Migrations applied.');
        break;
      case 'seed':
        await seedDemo(handle.db);
        break;
      case 'user':
        await cmdUser(handle.db);
        break;
      case 'jobs':
        await cmdJobs(handle.db);
        break;
      case 'matches':
        await cmdMatches(handle.db);
        break;
      case 'applications':
        await cmdApplications(handle.db);
        break;
      case 'application':
        if (!arg) throw new Error('Usage: cli application <id>');
        await cmdApplication(handle.db, arg);
        break;
      case 'reviews':
        await cmdReviews(handle.db);
        break;
      default:
        console.log(USAGE);
    }
  } finally {
    await handle.close();
  }
}

if (isEntrypoint(import.meta.url)) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('CLI error:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
