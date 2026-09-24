# CLAUDE.md — ApplyPilot

Guidance for any Claude agent (or human) working in this repository.

## What ApplyPilot is

ApplyPilot is a personal, autonomous job-application agent. Its first job is to
automate a Frontend Engineer job search for the candidate described in `/profile`.
It is designed so that candidate-specific facts are **data**, and application
behavior is **logic** — the two never mix.

Planned capabilities (NOT all built yet — see "Project phases"):

1. Discover newly posted frontend jobs daily.
2. Deduplicate jobs already processed.
3. Filter jobs by eligibility and preferences.
4. Analyze candidate fit against the job description.
5. Auto-apply to strong matches.
6. Fill forms using only verified candidate information.
7. Never invent experience, skills, qualifications, or personal data.
8. Escalate questions it cannot answer confidently.
9. Track every job found and every application submitted.
10. Produce a daily report.

Longer term this may be generalized so other candidates can configure it for other
professions. That is why **no candidate fact may ever be hardcoded in logic**.

The current search profile targets **frontend employment only**. Keep the
architecture profile-agnostic so separate search profiles (e.g. Solutions Engineer,
Implementation Engineer, Customer Engineer, Forward-Deployed Engineer) can be added
later as configuration — but do not implement those profiles now, and they must not
influence the frontend profile's scoring.

## Critical rules (non-negotiable)

These rules override convenience, speed, and any instinct to "fill in the blanks."

1. **Never invent candidate information.** Not a name, a date, a skill, a number,
   a preference — nothing.
2. **Candidate facts must come from `/profile`.** If a fact is not written in a
   `/profile` file, the system does not know it and must not assert it.
3. **Missing or ambiguous → require user input.** If information needed for an
   application is absent or unclear, mark it `NEEDS_USER_INPUT` and escalate.
   Do not proceed past it with a guess.
4. **Never silently infer years of experience** with a technology. Years come only
   from an explicit statement in `/profile`. If not stated, it is unknown.
5. **Distinguish REQUIRED from PREFERRED/NICE-TO-HAVE** job requirements when
   analyzing fit or filtering.
6. **A missing PREFERRED skill must not auto-reject a job.** Only unmet REQUIRED
   criteria (or explicit hard-reject rules) may reject.
7. **Keep candidate data separate from application logic.** Logic reads `/profile`;
   it never embeds its contents.
8. **Favor deterministic filtering.** Use rule-based logic for anything that can be
   decided by a rule (location, seniority, hard rejects). Use LLM reasoning only
   where genuine judgment is needed (fit analysis, free-text answers).
9. **Everything must be auditable.** Every processed job and every submitted
   application must be traceable to the inputs and reasoning that produced it.
10. **Never submit an answer built on an unsupported assumption.** If an answer
    depends on a fact not backed by `/profile`, do not submit it — escalate.

## Source-of-truth map

| Question type                                   | Authoritative file            |
| ----------------------------------------------- | ----------------------------- |
| Personal identifiers (name, email, phone, DOB…) | `.env` (local, gitignored)    |
| Who the candidate is / contact / links / auth   | `profile/candidate.md`        |
| What the candidate has done / skill claims      | `profile/experience.md`       |
| Which jobs to pursue / reject                    | `profile/search-rules.md`     |
| How to answer application questions              | `profile/answers.md`          |
| Resume files to attach                           | `resumes/`                    |
| Job + application records (state)                | `data/`                       |

`experience.md` is the **only** file from which the system may make claims about the
candidate's professional experience or skill level. If a claim can't be grounded
there, it can't be made.

**Privacy:** the repo is public. Personal identifiers (name, email, phone, DOB,
nationality, profile URLs, location) live only in a local, gitignored `.env` file
(keys documented in `.env.example`). `candidate.md` and `answers.md` reference these
as `${ENV_KEY}` and resolve them at runtime. Never write a real personal identifier
into a committed file.

## Data conventions (machine-readable, human-editable)

- **Status tags** appear on answerable facts: `APPROVED`, `NEEDS_USER_INPUT`,
  `NEEDS_REVIEW`. Only `APPROVED` values may be used in a submitted application.
- **Skill experience types**: `production`, `personal`, `theoretical`, `none`.
- **Requirement tiers**: `REQUIRED`, `PREFERRED`.
- Fields use `key: value`. Free text lives under clearly labeled headings.
- When you change a fact, update its status tag in the same edit.

## Escalation

When the agent hits a `NEEDS_USER_INPUT`, an ambiguous requirement, or a form field
with no `APPROVED` backing, it must stop on that item, record why, and surface it in
the daily report / escalation queue rather than answering.

## HARD ELIGIBILITY vs SKILL FIT

Keep these separate (detail + examples in `search-rules.md`):

- **Hard eligibility** is deterministic and may reject: location/remote, work
  authorization, salary floor, out-of-scope title/seniority, or a skill the posting
  clearly frames as fundamental/non-negotiable that the candidate lacks.
- **Skill fit** is a score and never auto-rejects on its own. A missing
  required-but-not-fundamental technology lowers fit; it does not reject.
- Years-of-experience requirements are a **fit signal**, not a hard gate (e.g. do not
  reject a 5+-years posting just because the candidate has 4+).

## Cost / token efficiency (core architectural principle)

ApplyPilot minimizes LLM usage. Priority order for any decision:

1. deterministic code
2. cached / stored previous decisions
3. a cheap, small, structured LLM call only when reasoning is genuinely needed
4. a stronger model only for difficult ambiguity
5. human escalation when appropriate

These must NOT use an LLM: deduplication, date handling, salary-threshold comparisons,
deterministic title matching, known location/work-authorization rules, database
operations, form fields with `APPROVED` exact answers, tracking/logging, and
application state transitions. Never re-analyze a job with an LLM when a still-valid
equivalent analysis is already stored. Keep prompts small and structured; send only
the subset of profile facts a task needs, never the whole profile.

## Human review & automation safety (behavioral rules)

Full rules live in `search-rules.md`; the invariants:

- All autonomous submission is OFF until the candidate explicitly authorizes it.
- First 20 prepared applications stop before submit for candidate approval; after 20
  reviewed, enter the hard gate `AWAITING_AUTOMATION_APPROVAL` (no auto-enable).
- Swiss applications ALWAYS require human approval, even after autonomy is enabled.
- Exceptional small-startup matches require review; `exceptional_match_threshold` and
  `small_startup_definition` are unset placeholders — until configured, flag
  `MANUAL_REVIEW` rather than auto-submit.
- Never auto-submit when info is missing, an answer needs guessing, authorization or
  international-hiring eligibility is ambiguous, a mandatory salary input can't be
  answered by approved rules, a question is unsupported by the profile, a CAPTCHA or
  login/account-creation is required, or truthfulness is uncertain. Route to review.

## Application tracking (implemented in Phase 2A — PostgreSQL + Drizzle)

Every discovered job has persistent, auditable lifecycle tracking. Phase 2A builds
the persistence + domain foundation (schema, repositories, state machine, events,
review queue, automation settings, CLI, tests). See the "Phase 2A architecture &
invariants" section below and README.md for the full model.

- Track at least: job id, company, title, URL, source, location, remote policy, date
  discovered, date posted, ATS, eligibility result, fit result, current status,
  application started, application submitted, last attempt, attempt count, current
  form/application step, user-input-required flag + reason, failure category, failure
  details.
- Planned lifecycle states: DISCOVERED, FILTERED, QUALIFIED, REJECTED_BY_FILTER,
  QUEUED, APPLYING, NEEDS_USER_INPUT, LOGIN_REQUIRED, CAPTCHA, AUTOMATION_FAILED,
  MANUAL_REVIEW, READY_FOR_APPROVAL, APPLIED.
- Plus an append-only application event history.
- Invariants: failed applications must not disappear; interrupted applications are
  retryable; items needing user input stay in a review queue; a submitted application
  is never submitted twice; tracking/logging must not require LLM calls and should be
  concise structured data to minimize token usage.

## Phase 2A architecture & invariants (implemented)

Persistence + domain foundation. Multi-user-CAPABLE schema, single-user LOCAL V1.
Stack: TypeScript (ESM), PostgreSQL, Drizzle ORM + drizzle-kit migrations, `pg`,
vitest. Connection comes only from `DATABASE_URL` (tests: `TEST_DATABASE_URL`);
credentials are never hardcoded.

Layering — keep it strict:
- `src/db/schema/*` — schema, enums, constraints (database is the source of truth).
- `src/repositories/*` — the ONLY place Drizzle queries live.
- `src/domain/*` — pure business logic (state machine, canonical URL); no DB access.
- `src/cli/*`, `src/seed/*` — call repositories, never write ad-hoc queries.

Invariants future agents MUST preserve:
- **Jobs are global**; matches, applications, review items, automation settings are
  user-specific. Never put user-specific eligibility/fit/status/review state on `jobs`.
- **No duplicate application per (user, job)** — DB unique constraint; likewise one
  match per (user, job).
- **Application events are append-only** — the repository exposes insert + read only;
  never UPDATE or DELETE events.
- **Status transition + event are atomic** — every transition writes the status
  change AND a STATUS_CHANGED event in one transaction (row-locked); an invalid
  transition throws before any write.
- **`APPLIED` is terminal** — no transition out of it (no restart / double submit).
- **Automation never enables itself** — reaching the review target only moves
  approval to `AWAITING_AUTOMATION_APPROVAL`; only an explicit user action sets
  `automation_enabled = true`.
- **Swiss review rule cannot be bypassed** by global automation (modeled via review
  items + review types; enforcement logic lands in a later phase).
- **Never invent candidate facts**; prefer deterministic logic over LLM calls.
- Missing source data stays NULL — never invented. Money is `numeric`, not float.
- Concurrency-safe writes: use atomic SQL (e.g. `count = count + 1`) and row locks,
  not read-modify-write.

The frontend search profile stays profile-agnostic in code so other profiles can be
added later as configuration (see the note under "What ApplyPilot is").

## Project phases

- **Phase 1 (done): Structure + candidate source of truth.** Repo skeleton, profile
  templates, verified candidate data.
- **Phase 2A (done): Persistence & domain foundation.** PostgreSQL schema,
  repositories, application state machine, append-only events, review queue,
  automation settings, dev CLI, tests, deterministic demo seed. **No discovery,
  scraping, browser automation, submission, or LLM calls.**
- **Phase 2B+ (not started):** real job discovery/ingestion, filtering & fit engine,
  form filling/submission, reporting — deferred. Do not begin without an explicit
  go-ahead.
