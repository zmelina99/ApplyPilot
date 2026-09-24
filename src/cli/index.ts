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
import { planAnalysis, runAnalysis, cleanupNonBlockingReviews } from '../pipeline/analyze.js';
import { loadCandidateFacts } from '../config/candidateFacts.js';
import { buildCandidateAnalysis } from '../analysis/candidateAnalysis.js';
import { AnthropicFitAnalyzer, hasLlmCredential, analyzerModel } from '../analysis/anthropicAnalyzer.js';
import type { FitAnalysis } from '../analysis/types.js';
import { rankByFit } from '../analysis/ranking.js';
import type { MatchWithJob } from '../repositories/jobMatches.js';
import { isEntrypoint } from '../util/entrypoint.js';

const USAGE = `ApplyPilot dev CLI

  discover                 Fetch real jobs, store, dedup, deterministic eligibility + salary
  analyze [--dry-run]      Semantic fit analysis of eligible + non-blocking-ambiguous jobs
  shortlist [--limit N] [--min-fit N]   Fit-ranked jobs worth applying to
  job <id>                 One job: sources, eligibility, and fit breakdown
  rejected                 Deterministically rejected jobs, by reason
  review [list|show <id>|resolve <id>|reject <id>|cleanup] [--note "..."]
  db | migrate | seed | user | jobs | matches | applications | application <id>
`;

// --- flag parsing -----------------------------------------------------------
interface Parsed { positionals: string[]; flags: Record<string, string | boolean> }
function parseArgs(args: string[]): Parsed {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; }
      else flags[key] = true;
    } else positionals.push(a);
  }
  return { positionals, flags };
}

// --- formatting helpers -----------------------------------------------------
function daysAgo(d: Date | null): string {
  if (!d) return 'n/a';
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? 'today' : `${days}d`;
}
function fmtSalary(job: MatchWithJob['job']): string {
  if (!job.salaryMin && !job.salaryMax) return 'n/a';
  return `${job.salaryMin ?? '?'}-${job.salaryMax ?? '?'} ${job.salaryCurrency ?? ''}/${job.salaryPeriod ?? ''}`;
}
function fitOf(mw: MatchWithJob): FitAnalysis | null {
  return (mw.match.fitAnalysis as FitAnalysis | null) ?? null;
}
function priorityOf(mw: MatchWithJob): boolean {
  return Boolean((mw.match.evaluationDetails as { priority?: boolean } | null)?.priority);
}

function rankAnalyzed(rows: MatchWithJob[]): MatchWithJob[] {
  return rankByFit(rows, (mw) => ({
    fitScore: mw.match.fitScore,
    priority: priorityOf(mw),
    datePosted: mw.job.datePosted,
    confidence: fitOf(mw)?.confidence ?? null,
  }));
}

async function requireUserId(db: Database): Promise<string> {
  const user = await usersRepo.getFirstUser(db);
  if (!user) throw new Error('No data yet. Run: npm run discover  (or npm run db:seed for the demo)');
  return user.id;
}

// --- commands ---------------------------------------------------------------
async function cmdDiscover(db: Database): Promise<void> {
  console.log('Running discovery (real sources)…');
  const s = await runDiscovery(db);
  console.log('\n=== Discovery summary ===');
  for (const [name, n] of Object.entries(s.perSource)) console.log(`  source ${name.padEnd(12)} fetched ${n}`);
  for (const e of s.sourceErrors) console.log(`  source ${e.source} ERROR: ${e.error}`);
  console.log(`  Discovered:      ${s.discovered}`);
  console.log(`  New / Existing:  ${s.newJobs} / ${s.existingJobs} (duplicates ${s.duplicates})`);
  console.log(`  Salary parsed:   ${s.salaryExtracted}`);
  console.log(`  Eligible:        ${s.eligible}`);
  console.log(`  Rejected:        ${s.rejected}`);
  console.log(`  Needs review:    ${s.needsReview} (non-blocking; analyzed for fit next)`);
  if (Object.keys(s.rejectionReasons).length) {
    console.log('  Top rejection reasons:');
    for (const [c, n] of Object.entries(s.rejectionReasons).sort((a, b) => b[1] - a[1])) console.log(`    ${c.padEnd(28)} ${n}`);
  }
  console.log('\nNext: npm run analyze -- --dry-run   then   npm run analyze');
}

async function cmdAnalyze(db: Database, flags: Parsed['flags']): Promise<void> {
  const dryRun = Boolean(flags['dry-run']);
  const facts = loadCandidateFacts();
  const candidate = buildCandidateAnalysis(facts);
  const plan = await planAnalysis(db, candidate);

  const user = await usersRepo.getFirstUser(db);
  const openNonBlocking = user
    ? (await reviewsRepo.listUnresolvedReviews(db, user.id)).filter((r) =>
        ['AMBIGUOUS_ELIGIBILITY', 'SALARY_QUESTION', 'OTHER'].includes(r.reviewType),
      ).length
    : 0;

  console.log(`Analysis plan${dryRun ? ' (dry run — no LLM calls)' : ''}:`);
  console.log(`  Eligible jobs:                 ${plan.eligible}`);
  console.log(`  Non-blocking ambiguous jobs:   ${plan.nonBlockingAmbiguous}`);
  console.log(`  Deterministic rejects skipped: ${plan.deterministicRejectsSkipped}`);
  console.log(`  Already cached:                ${plan.alreadyCached}`);
  console.log(`  Would analyze:                 ${plan.wouldAnalyze}`);
  console.log(`  (analyzable = eligible + non-blocking ambiguous)`);
  console.log(`  Non-blocking review items to clear: ${openNonBlocking}`);
  console.log(`  Profile version: ${facts.profileVersion} | model: ${analyzerModel()} | LLM configured: ${hasLlmCredential() ? 'yes' : 'no'}`);

  if (dryRun) {
    console.log('\nDry run only — no changes made.');
    return;
  }
  if (!hasLlmCredential()) {
    console.log('\nCannot run real analysis: ANTHROPIC_API_KEY is not set.');
    console.log('Set it in .env (ANTHROPIC_API_KEY=sk-ant-...), then re-run `npm run analyze`.');
    return;
  }

  const cleaned = await cleanupNonBlockingReviews(db);
  console.log(`\nDismissed ${cleaned} non-blocking review items (superseded by fit analysis).`);
  console.log(`Analyzing ${plan.wouldAnalyze} job(s) with ${analyzerModel()}…`);
  const analyzer = new AnthropicFitAnalyzer();
  const stats = await runAnalysis(db, candidate, analyzer, plan);
  console.log('\n=== Analysis results ===');
  console.log(`  Analyzed (new):  ${stats.analyzed}`);
  console.log(`  Cache hits:      ${stats.cacheHits}`);
  console.log(`  LLM calls:       ${stats.llmCalls}`);
  console.log(`  Failed:          ${stats.failed}`);
  console.log(`  Input tokens:    ${stats.inputTokens}`);
  console.log(`  Output tokens:   ${stats.outputTokens}`);
  for (const e of stats.errors.slice(0, 5)) console.log(`  ! ${e.jobId.slice(0, 8)}: ${e.error}`);
  console.log('\nSee: npm run shortlist');
}

async function cmdShortlist(db: Database, flags: Parsed['flags']): Promise<void> {
  const userId = await requireUserId(db);
  const limit = flags['limit'] ? Number(flags['limit']) : 15;
  const minFit = flags['min-fit'] ? Number(flags['min-fit']) : 0;
  const rows = rankAnalyzed(await matchesRepo.listAnalyzedWithJobs(db, userId, minFit));
  if (rows.length === 0) {
    const analyzable = await matchesRepo.listMatchesWithJobsByEligibility(db, userId, ['ELIGIBLE', 'AMBIGUOUS']);
    console.log(`No fit-analyzed jobs yet (${analyzable.length} awaiting analysis).`);
    console.log('Run: npm run analyze   (needs ANTHROPIC_API_KEY; preview with `npm run analyze -- --dry-run`)');
    return;
  }
  console.log(`Shortlist — ${rows.length} analyzed${minFit ? ` (min-fit ${minFit})` : ''}, showing ${Math.min(limit, rows.length)} (ranked by fit):\n`);
  console.log('FIT  STATUS      COMPANY / ROLE');
  for (const mw of rows.slice(0, limit)) {
    const a = fitOf(mw);
    const score = mw.match.fitScore ?? 0;
    console.log(
      `${String(score).padStart(3)}  ${(mw.match.fitStatus ?? '?').padEnd(10)}  ${mw.job.companyName ?? '?'} — ${mw.job.title ?? '?'}`,
    );
    console.log(`      ${mw.job.remoteType} | ${mw.job.locationText ?? '-'} | posted ${daysAgo(mw.job.datePosted)} | ${fmtSalary(mw.job)} | src=${(await sourcesFor(db, mw.job.id))}`);
    if (a) {
      if (a.matching_requirements.length) console.log(`      + ${a.matching_requirements.slice(0, 3).join(', ')}`);
      const gap = a.missing_requirements[0] ?? a.preferred_skill_gaps[0];
      if (gap) console.log(`      △ gap: ${gap}`);
      if (a.uncertainties[0]) console.log(`      ? ${a.uncertainties[0]}`);
    }
    console.log(`      ${mw.job.canonicalUrl}`);
  }
}

async function sourcesFor(db: Database, jobId: string): Promise<string> {
  const s = await jobSourcesRepo.listSourcesForJob(db, jobId);
  return [...new Set(s.map((x) => x.sourceName))].join(',') || '-';
}

async function cmdJob(db: Database, id: string): Promise<void> {
  const all = await jobsRepo.listJobs(db, 2000);
  const job = all.find((j) => j.id === id || j.id.startsWith(id));
  if (!job) return console.log(`Job not found: ${id}`);
  console.log(`${job.title ?? '-'} @ ${job.companyName ?? '-'}`);
  console.log(`  ${job.remoteType} | ${job.locationText ?? '-'} | posted ${daysAgo(job.datePosted)} | ${job.salaryMin ?? '?'}-${job.salaryMax ?? '?'} ${job.salaryCurrency ?? ''} ${job.salaryPeriod ?? ''}`);
  const sources = await jobSourcesRepo.listSourcesForJob(db, job.id);
  console.log(`  Sources: ${sources.map((s) => `${s.sourceName}${s.sourceJobId ? `#${s.sourceJobId}` : ''}`).join(', ')}`);
  const user = await usersRepo.getFirstUser(db);
  const match = user ? await matchesRepo.getMatch(db, user.id, job.id) : null;
  if (!match) return console.log(`  ${job.canonicalUrl}`);

  const a = match.fitAnalysis as FitAnalysis | null;
  if (a) {
    console.log(`\nFIT SCORE: ${a.fit_score}`);
    console.log(`FIT STATUS: ${a.fit_status}  (confidence ${a.confidence})`);
    console.log(`  role ${a.role_alignment.score} · technical ${a.technical_match.score} · experience ${a.experience_match.score} · responsibility ${a.responsibility_match.score}`);
    console.log('MATCHES');
    for (const m of a.matching_requirements) console.log(`  ✓ ${m}`);
    if (a.matching_requirements.length === 0) console.log('  (none listed)');
    console.log('GAPS');
    for (const g of a.missing_requirements) console.log(`  ✗ ${g} (required)`);
    for (const g of a.preferred_skill_gaps) console.log(`  △ ${g} (preferred)`);
    if (a.missing_requirements.length + a.preferred_skill_gaps.length === 0) console.log('  None');
    console.log('CONCERNS');
    for (const c of a.hard_requirement_concerns) console.log(`  ! ${c}`);
    if (a.hard_requirement_concerns.length === 0) console.log('  None');
    console.log('UNCERTAINTIES');
    for (const u of a.uncertainties) console.log(`  ? ${u}`);
    if (a.uncertainties.length === 0) console.log('  None');
    console.log(`SUMMARY\n  ${a.summary}`);
  } else {
    console.log(`\nFIT: not analyzed yet (run: npm run analyze)`);
  }
  console.log(`ELIGIBILITY\n  ${match.eligibilityStatus} — ${match.eligibilityReason ?? '-'}`);
  console.log(`URL\n  ${job.canonicalUrl}`);
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
  for (const [k, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) console.log(`  ${String(k).padEnd(34)} ${n}`);
}

async function cmdReview(db: Database, positionals: string[], flags: Parsed['flags']): Promise<void> {
  const sub = positionals[0] ?? 'list';
  const userId = await requireUserId(db);
  const note = typeof flags['note'] === 'string' ? flags['note'] : undefined;
  switch (sub) {
    case 'list': {
      const open = await reviewsRepo.listUnresolvedReviews(db, userId);
      if (open.length === 0) return console.log('No open (blocking) review items.');
      console.log(`Open blocking review items (${open.length}):`);
      for (const r of open) console.log(`  [${r.id.slice(0, 8)}] ${r.reviewType} — ${r.reason ?? ''}`);
      break;
    }
    case 'show': {
      const item = await reviewsRepo.getReviewItem(db, positionals[1] ?? '');
      if (!item) return console.log('Review not found.');
      console.log(JSON.stringify({ id: item.id, type: item.reviewType, status: item.status, reason: item.reason, jobId: item.jobId, payload: item.payload }, null, 2));
      break;
    }
    case 'resolve':
    case 'reject': {
      const id = positionals[1];
      if (!id) throw new Error(`Usage: cli review ${sub} <id> [--note "..."]`);
      const item = await reviewsRepo.resolveReviewItem(db, id, sub === 'resolve' ? 'RESOLVED' : 'DISMISSED', note);
      console.log(`Review ${item.id.slice(0, 8)} → ${item.status}${note ? ` (note saved)` : ''}`);
      break;
    }
    case 'cleanup': {
      const n = await cleanupNonBlockingReviews(db);
      console.log(`Dismissed ${n} non-blocking review item(s).`);
      break;
    }
    default:
      console.log('Usage: cli review [list|show <id>|resolve <id>|reject <id>|cleanup] [--note "..."]');
  }
}

async function cmdDb(db: Database): Promise<void> {
  const tables = ['users', 'user_automation_settings', 'jobs', 'job_sources', 'job_matches', 'applications', 'application_events', 'review_items'];
  console.log('Database connection OK. Row counts:');
  for (const t of tables) {
    const result = await db.execute(sql.raw(`select count(*)::int as c from ${t}`));
    console.log(`  ${t.padEnd(26)} ${(result.rows[0] as { c: number } | undefined)?.c ?? 0}`);
  }
}
async function cmdUser(db: Database): Promise<void> {
  const user = await usersRepo.getFirstUser(db);
  if (!user) return console.log('No user. Run: npm run discover');
  const s = await automationRepo.getSettings(db, user.id);
  console.log(`User ${user.id} (${user.displayName ?? '-'})`);
  console.log(`  automation_enabled ${s?.automationEnabled} | review ${s?.initialReviewCount}/${s?.initialReviewTarget} | approval ${s?.automationApprovalStatus}`);
}
async function cmdJobs(db: Database): Promise<void> {
  const jobs = await jobsRepo.listJobs(db);
  console.log(`Jobs (${jobs.length}):`);
  for (const j of jobs.slice(0, 40)) console.log(`  [${j.id.slice(0, 8)}] ${j.title ?? '?'} @ ${j.companyName ?? '?'} | ${j.remoteType}`);
}
async function cmdMatches(db: Database): Promise<void> {
  const userId = await requireUserId(db);
  const rows = await matchesRepo.listMatchesForUser(db, userId, 40);
  console.log(`Matches (${rows.length} shown):`);
  for (const m of rows) console.log(`  [${m.id.slice(0, 8)}] ${m.status} | elig=${m.eligibilityStatus} | fit=${m.fitStatus}${m.fitScore != null ? `(${m.fitScore})` : ''}`);
}
async function cmdApplications(db: Database): Promise<void> {
  const userId = await requireUserId(db);
  const apps = await applicationsRepo.listApplicationsForUser(db, userId);
  if (apps.length === 0) return console.log('No applications.');
  for (const a of apps) console.log(`  [${a.id.slice(0, 8)}] job ${a.jobId.slice(0, 8)} | ${a.status} | attempts=${a.attemptCount}`);
}
async function cmdApplication(db: Database, id: string): Promise<void> {
  const app = await applicationsRepo.getApplication(db, id);
  if (!app) return console.log(`Application not found: ${id}`);
  console.log(`Application ${app.id} | ${app.status} | attempts ${app.attemptCount}`);
  const history = await eventsRepo.getApplicationHistory(db, app.id);
  for (const e of history) console.log(`  ${e.createdAt.toISOString()}  ${e.eventType} ${e.fromStatus ?? '·'} -> ${e.toStatus ?? '·'}`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const { positionals, flags } = parseArgs(rest);
  const handle = createAppDb();
  try {
    switch (command) {
      case 'discover': await cmdDiscover(handle.db); break;
      case 'analyze': await cmdAnalyze(handle.db, flags); break;
      case 'shortlist': await cmdShortlist(handle.db, flags); break;
      case 'job': if (!positionals[0]) throw new Error('Usage: cli job <id>'); await cmdJob(handle.db, positionals[0]); break;
      case 'rejected': await cmdRejected(handle.db); break;
      case 'review': await cmdReview(handle.db, positionals, flags); break;
      case 'db': await cmdDb(handle.db); break;
      case 'migrate': await runMigrations(handle.db); console.log('Migrations applied.'); break;
      case 'seed': await seedDemo(handle.db); break;
      case 'user': await cmdUser(handle.db); break;
      case 'jobs': await cmdJobs(handle.db); break;
      case 'matches': await cmdMatches(handle.db); break;
      case 'applications': await cmdApplications(handle.db); break;
      case 'application': if (!positionals[0]) throw new Error('Usage: cli application <id>'); await cmdApplication(handle.db, positionals[0]); break;
      default: console.log(USAGE);
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
