import { createAppDb, type Database } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { usersRepo, jobsRepo, jobSourcesRepo, matchesRepo, applicationsRepo, reviewsRepo } from '../repositories/index.js';
import { isEntrypoint } from '../util/entrypoint.js';

/**
 * Deterministic demo seed. Uses obviously fictional companies and NO real personal
 * data. Makes ZERO LLM calls — every "evaluation" here is a hardcoded fixture value,
 * not a real analysis. Its job is to demonstrate the domain flow end-to-end:
 *
 *   JOB DISCOVERED → SOURCE RECORDED → USER/JOB MATCH → MATCH EVALUATED →
 *   APPLICATION CREATED → STATUS TRANSITIONS → REVIEW ITEM → REVIEW RESOLVED →
 *   APPLICATION EVENT HISTORY AVAILABLE
 *
 * Idempotent: safe to re-run (jobs upsert by canonical URL; sources/matches/apps are
 * conflict-guarded).
 */
export async function seedDemo(db: Database): Promise<void> {
  // 1) One local V1 user (no auth, no PII).
  let user = await usersRepo.getFirstUser(db);
  if (!user) {
    user = await usersRepo.createUser(db, { displayName: 'Local User' });
  }

  // --- Job A: eligible remote European frontend role ---
  const jobA = await jobsRepo.upsertJob(db, {
    canonicalUrl: 'https://careers.acmewidgets.example/jobs/frontend-eu-101',
    companyName: 'Acme Widgets (fictional)',
    title: 'Senior Frontend Engineer',
    locationText: 'Remote — Europe',
    remoteType: 'REMOTE',
    employmentType: 'PERMANENT',
    description: 'React + TypeScript. Remote anywhere in Europe.',
    salaryMin: '65000',
    salaryMax: '80000',
    salaryCurrency: 'EUR',
    salaryPeriod: 'YEAR',
    datePosted: new Date('2026-09-20T00:00:00Z'),
  });
  await jobSourcesRepo.attachSource(db, {
    jobId: jobA.id,
    sourceName: 'demo-board',
    sourceJobId: 'acme-101',
    sourceUrl: 'https://careers.acmewidgets.example/jobs/frontend-eu-101',
    rawPayload: { demo: true, note: 'eligible remote EU' },
  });
  const matchA = await matchesRepo.createMatch(db, user.id, jobA.id);
  await matchesRepo.updateEvaluation(db, matchA.id, {
    status: 'QUALIFIED',
    eligibilityStatus: 'ELIGIBLE',
    eligibilityReason: 'Remote Europe; no local work-auth barrier.',
    fitStatus: 'STRONG',
    fitScore: 92,
    fitReason: 'React + TypeScript core match.',
    evaluationVersion: 'demo-v1',
  });
  // Application progresses to READY_FOR_APPROVAL (initial safety period → review).
  const appA = await applicationsRepo.createApplication(db, user.id, jobA.id);
  await applicationsRepo.incrementAttemptCount(db, appA.id);
  await applicationsRepo.transitionStatus(db, appA.id, 'APPLYING');
  await applicationsRepo.transitionStatus(db, appA.id, 'READY_FOR_APPROVAL');
  await reviewsRepo.createReviewItem(db, {
    userId: user.id,
    reviewType: 'INITIAL_APPLICATION_APPROVAL',
    jobId: jobA.id,
    applicationId: appA.id,
    reason: 'Within initial 20-application safety period — needs approval.',
  });

  // --- Job B: US role requiring US residence/work authorization ---
  const jobB = await jobsRepo.upsertJob(db, {
    canonicalUrl: 'https://jobs.globex.example/postings/fe-usa-7',
    companyName: 'Globex Corp (fictional)',
    title: 'Frontend Developer',
    locationText: 'Remote — US only (must reside in US)',
    remoteType: 'REMOTE',
    employmentType: 'PERMANENT',
    description: 'Requires US work authorization and US residence.',
    salaryMin: '110000',
    salaryMax: '140000',
    salaryCurrency: 'USD',
    salaryPeriod: 'YEAR',
    datePosted: new Date('2026-09-18T00:00:00Z'),
  });
  await jobSourcesRepo.attachSource(db, {
    jobId: jobB.id,
    sourceName: 'demo-board',
    sourceJobId: 'globex-7',
    sourceUrl: 'https://jobs.globex.example/postings/fe-usa-7',
    rawPayload: { demo: true, note: 'US residency required' },
  });
  const matchB = await matchesRepo.createMatch(db, user.id, jobB.id);
  await matchesRepo.updateEvaluation(db, matchB.id, {
    status: 'REJECTED',
    eligibilityStatus: 'INELIGIBLE',
    eligibilityReason: 'Requires US residence/work authorization; no intl hiring route.',
    fitStatus: 'STRONG',
    fitScore: 88,
    fitReason: 'Skills fit, but hard-ineligible on location.',
    evaluationVersion: 'demo-v1',
  });
  // Rejected by filter → no application is created (demonstrates eligibility gate).

  // --- Job C: Swiss frontend role (always requires human approval) ---
  const jobC = await jobsRepo.upsertJob(db, {
    canonicalUrl: 'https://karriere.initech.example.ch/de/stellen/fe-zurich-3',
    companyName: 'Initech Schweiz (fictional)',
    title: 'Frontend Engineer',
    locationText: 'Zürich, Switzerland (hybrid)',
    remoteType: 'HYBRID',
    employmentType: 'PERMANENT',
    description: 'Frontend role based in Zurich.',
    salaryMin: '95000',
    salaryMax: '115000',
    salaryCurrency: 'CHF',
    salaryPeriod: 'YEAR',
    datePosted: new Date('2026-09-22T00:00:00Z'),
  });
  await jobSourcesRepo.attachSource(db, {
    jobId: jobC.id,
    sourceName: 'demo-board',
    sourceJobId: 'initech-3',
    sourceUrl: 'https://karriere.initech.example.ch/de/stellen/fe-zurich-3',
    rawPayload: { demo: true, note: 'Swiss — always review' },
  });
  const matchC = await matchesRepo.createMatch(db, user.id, jobC.id);
  await matchesRepo.updateEvaluation(db, matchC.id, {
    status: 'QUALIFIED',
    eligibilityStatus: 'ELIGIBLE',
    eligibilityReason: 'Switzerland eligible; CHF salary above floor.',
    fitStatus: 'STRONG',
    fitScore: 90,
    fitReason: 'Strong React/TS fit.',
    evaluationVersion: 'demo-v1',
  });
  const appC = await applicationsRepo.createApplication(db, user.id, jobC.id);
  await applicationsRepo.transitionStatus(db, appC.id, 'APPLYING');
  await applicationsRepo.transitionStatus(db, appC.id, 'READY_FOR_APPROVAL');
  await reviewsRepo.createReviewItem(db, {
    userId: user.id,
    reviewType: 'SWISS_APPLICATION',
    jobId: jobC.id,
    applicationId: appC.id,
    reason: 'Swiss application — always requires human approval before submit.',
  });

  // --- Job D: role that hits automation trouble → manual review ---
  const jobD = await jobsRepo.upsertJob(db, {
    canonicalUrl: 'https://apply.umbrella.example/openings/fe-remote-42',
    companyName: 'Umbrella Remote (fictional)',
    title: 'React Engineer',
    locationText: 'Remote — Worldwide',
    remoteType: 'REMOTE',
    employmentType: 'CONTRACT',
    description: 'Worldwide remote React role.',
    salaryMin: '55000',
    salaryMax: '70000',
    salaryCurrency: 'EUR',
    salaryPeriod: 'YEAR',
    datePosted: new Date('2026-09-21T00:00:00Z'),
  });
  await jobSourcesRepo.attachSource(db, {
    jobId: jobD.id,
    sourceName: 'demo-board',
    sourceJobId: 'umbrella-42',
    sourceUrl: 'https://apply.umbrella.example/openings/fe-remote-42',
    rawPayload: { demo: true, note: 'triggers manual review' },
  });
  const matchD = await matchesRepo.createMatch(db, user.id, jobD.id);
  await matchesRepo.updateEvaluation(db, matchD.id, {
    status: 'QUALIFIED',
    eligibilityStatus: 'ELIGIBLE',
    eligibilityReason: 'Worldwide remote; eligible.',
    fitStatus: 'MODERATE',
    fitScore: 74,
    fitReason: 'Good fit; contract terms need a look.',
    evaluationVersion: 'demo-v1',
  });
  const appD = await applicationsRepo.createApplication(db, user.id, jobD.id);
  await applicationsRepo.transitionStatus(db, appD.id, 'APPLYING');
  // Automation hit a wall → route to MANUAL_REVIEW.
  await applicationsRepo.transitionStatus(db, appD.id, 'MANUAL_REVIEW', {
    failureCategory: 'AUTOMATION',
    failureDetails: 'Unexpected multi-step form; needs a human.',
  });
  await reviewsRepo.createReviewItem(db, {
    userId: user.id,
    reviewType: 'AUTOMATION_FAILURE',
    jobId: jobD.id,
    applicationId: appD.id,
    reason: 'Automation could not complete the form; manual review required.',
  });

  console.log('Demo seed complete for user', user.id);
}

export async function seedDemoApp(): Promise<void> {
  const handle = createAppDb();
  try {
    await runMigrations(handle.db);
    await seedDemo(handle.db);
  } finally {
    await handle.close();
  }
}

if (isEntrypoint(import.meta.url)) {
  seedDemoApp()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
