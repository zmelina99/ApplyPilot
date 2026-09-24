import { sql } from 'drizzle-orm';
import { createAppDb, type Database } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { seedDemo } from '../seed/demo.js';
import {
  usersRepo,
  automationRepo,
  jobsRepo,
  matchesRepo,
  applicationsRepo,
  eventsRepo,
  reviewsRepo,
} from '../repositories/index.js';
import { isEntrypoint } from '../util/entrypoint.js';

/**
 * Developer inspection/testing CLI. NOT the product UI. Deterministic, no LLM.
 * Usage: npm run cli -- <command> [args]
 */
const USAGE = `ApplyPilot dev CLI

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

async function requireUserId(db: Database): Promise<string> {
  const user = await usersRepo.getFirstUser(db);
  if (!user) {
    throw new Error('No user found. Run: npm run db:seed');
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
