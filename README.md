# ApplyPilot

A personal, autonomous job-application agent. It discovers frontend engineering
roles, filters them against the candidate's rules, analyzes fit, and (eventually)
applies — using **only verified candidate information** and escalating anything it
cannot answer confidently.

> **Status: Phase 2B — real discovery & deterministic eligibility.** ApplyPilot now
> pulls real current job postings from public APIs, stores/deduplicates them in
> PostgreSQL, applies deterministic eligibility rules, and produces an inspectable
> shortlist — all with **zero LLM calls**. No browser automation, scraping around
> anti-bot systems, or application submission; Phase 2B stops at the shortlist.
>
> **Architecture principle:** multi-user-CAPABLE schema, single-user LOCAL V1. The
> data model supports many users from the start so a future hosted product needs no
> redesign — but no SaaS infrastructure (auth, billing, UI, workers) is built now.

## Design principles

- **Candidate data ≠ application logic.** Everything specific to the candidate lives
  in `/profile` as editable data. Logic (to be built later) reads that data and
  never hardcodes it, so the tool can be reconfigured for other candidates.
- **Never invent facts.** If it isn't in `/profile`, the agent doesn't know it.
- **Deterministic first.** Rule-based filtering wherever possible; LLM reasoning only
  where judgment is genuinely needed.
- **Auditable by default.** Every job seen and application sent is traceable.

See [CLAUDE.md](CLAUDE.md) for the full rules any agent must follow.

## Repository layout

> **Privacy:** this repo is public, so personal identifiers (name, email, phone,
> DOB, nationality, profile URLs, location) live only in a local `.env` file that is
> gitignored. Copy `.env.example` to `.env` and fill it in. The committed profile
> files reference those values as `${ENV_KEY}` and never contain them literally.

```
apply-pilot/
├── CLAUDE.md            # Rules & architecture for agents working here
├── README.md            # This file
├── .env.example         # Template: personal-data keys + DATABASE_URL (copy to .env)
├── docker-compose.yml   # Minimal local PostgreSQL (dev only)
├── drizzle.config.ts    # drizzle-kit config (schema → migrations)
├── drizzle/             # Generated SQL migrations (committed)
├── config/
│   └── search-profile.json  # Machine-authoritative search config (from search-rules.md)
├── profile/             # Candidate source of truth (data, not logic)
│   ├── candidate.md     # Identity, contact, location, work auth, languages, links
│   ├── experience.md    # Authoritative record of experience & skill levels
│   ├── search-rules.md  # What jobs to pursue / reject; auto-apply criteria
│   └── answers.md       # Reusable, status-tagged answer bank for forms
├── src/
│   ├── config/          # env.ts (DATABASE_URL) + searchConfig.ts (search-profile loader)
│   ├── db/              # Drizzle client, schema (schema/*), migration runner
│   ├── domain/          # Pure logic: application state machine, canonical URL
│   ├── sources/         # JobSourceAdapter boundary + Remotive/Arbeitnow/Jobicy
│   ├── eligibility/     # Deterministic eligibility engine (no LLM)
│   ├── pipeline/        # discover.ts — end-to-end discovery orchestration
│   ├── repositories/    # The ONLY place DB queries live (one module per entity)
│   ├── seed/demo.ts     # Deterministic fictional demo (no LLM, no real data)
│   ├── cli/index.ts     # Developer inspection CLI (not the product UI)
│   └── util/            # Small helpers
├── tests/               # vitest suite (runs against TEST_DATABASE_URL)
├── resumes/             # Resume/CV files to attach to applications
└── data/                # (legacy Phase-1 notes; live state now lives in PostgreSQL)
```

## Profile status legend

Facts in `/profile` carry a status tag:

- `APPROVED` — verified; safe to use in a submitted application.
- `NEEDS_USER_INPUT` — unknown/unverified; the candidate must fill this in.
- `NEEDS_REVIEW` — drafted from the resume; the candidate should confirm or correct.

Only `APPROVED` values may appear in a submitted application.

## Getting started (Phase 1)

The candidate questionnaire has been applied: search rules, location/remote policy,
work-authorization policy, salary rules, experience/skills, education, review gates,
and form answers are now largely `APPROVED`. A few items still need input before
Phase 2 (see `profile/` for the remaining `NEEDS_USER_INPUT` / `NEEDS_REVIEW` tags):
personal identifiers in `.env` (LinkedIn/GitHub URLs, phone, current location),
German level, and a couple of soft-preference/threshold placeholders.

1. Fill remaining `.env` values (copy from `.env.example`).
2. Resolve the remaining `NEEDS_USER_INPUT` / `NEEDS_REVIEW` tags in `profile/`.
3. Add resume file(s) to `resumes/`.
4. Once the profile is complete and approved, Phase 2 (automation) can begin.

## Phase 2A — persistence & domain foundation

TypeScript · PostgreSQL · Drizzle ORM. The database connection comes only from
`DATABASE_URL` (never hardcoded), so the same code runs on local and managed
PostgreSQL without changes.

### Local setup

```bash
# 1. Start a local PostgreSQL (dev only)
docker compose up -d
docker compose exec db createdb -U applypilot applypilot_test   # once, for tests

# 2. Configure connection
cp .env.example .env        # then set DATABASE_URL + TEST_DATABASE_URL

# 3. Install, migrate, seed
npm install
npm run db:migrate
npm run db:seed
```

`.env` values for the provided compose file:

```
DATABASE_URL=postgres://applypilot:applypilot@localhost:5432/applypilot_dev
TEST_DATABASE_URL=postgres://applypilot:applypilot@localhost:5432/applypilot_test
```

(No Docker? Any local or managed PostgreSQL works — just point `DATABASE_URL` at it.)

### Commands

| Command | Purpose |
|---|---|
| `npm run db:generate` | Regenerate SQL migrations from the schema |
| `npm run db:migrate` | Apply migrations (idempotent) |
| `npm run db:seed` | Load the deterministic demo (fictional data) |
| `npm run cli -- <cmd>` | Inspect state (see below) |
| `npm test` | Run the vitest suite against `TEST_DATABASE_URL` |
| `npm run typecheck` | `tsc --noEmit` |

CLI commands: `db`, `migrate`, `seed`, `user`, `jobs`, `matches`, `applications`,
`application <id>` (with event history), `reviews`.

### Domain model

Jobs are **global**; everything user-specific hangs off the user:

```
User ── automation settings, JobMatches, Applications, ReviewItems
Job  ── normalized posting + JobSources
User + Job ── JobMatch (eligibility + fit)  and  Application (execution)
Application ── ApplicationEvents (append-only)
```

- **Job** — one normalized external posting, deduped by canonical URL. No
  user-specific state ever lives here.
- **JobSource** — where a job was discovered; a job may have several. Duplicate
  ingestion from the same source is prevented (unique on `(source_name, source_job_id)`
  when present, and always on `(source_name, source_url)`).
- **JobMatch** — evaluation of one job **for one user**: `eligibility_status`
  (hard rules) and `fit_status`/`fit_score` (soft), kept separate per the
  HARD-ELIGIBILITY-vs-SKILL-FIT rule. Unique per `(user, job)`.
- **Application** — one user's attempt to apply to one job. Unique per `(user, job)`
  (duplicate-submission protection).
- **ApplicationEvent** — append-only audit history (insert + read only).
- **ReviewItem** — persistent human-attention queue, owned by a user.

This lets User A qualify, User B reject, and User C apply to the **same** global job
with no duplication.

### Application state machine

`QUEUED → APPLYING → {NEEDS_USER_INPUT | LOGIN_REQUIRED | CAPTCHA | AUTOMATION_FAILED
| MANUAL_REVIEW | READY_FOR_APPROVAL | APPLIED}`; the interrupt states and
`MANUAL_REVIEW`/`READY_FOR_APPROVAL` route back toward `QUEUED`/`APPLIED`. **`APPLIED`
is terminal** — no restart. Invalid transitions are rejected.

Every transition writes the status change **and** a `STATUS_CHANGED` event in **one
transaction** (row-locked) — it is impossible to persist a new status without its
audit event, and a rejected transition leaves no partial writes.

### Review queue & automation state

Review items capture anything needing a human (initial-safety-period approval, Swiss
applications, automation failures, missing info, …). Automation is governed per user:
new users default to **disabled**, review target **20**, approval `NOT_REQUESTED`.
Reaching the target moves approval to `AWAITING_AUTOMATION_APPROVAL` but **never**
enables automation — only an explicit user action does. (Enforcement of the review
*policies* — Swiss detection, fit thresholds, startup detection — is deferred to a
later phase; only the persistence/domain support exists now.)

### Single-user V1 vs multi-user-capable

V1 seeds exactly one local user and builds no authentication, authorization, billing,
UI, workers, or cloud infra. But the schema is multi-user from day one (UUID keys,
per-user matches/applications/reviews, explicit foreign keys), so becoming a hosted
product later needs no database redesign.

### Testing

`npm test` runs against an **isolated** `TEST_DATABASE_URL` (the app refuses to fall
back to the dev DB). Covers migrations, multi-user isolation, dedup, unique
constraints, the state machine (valid/invalid/terminal), transition↔event atomicity,
append-only enforcement, review queue, and the automation invariants.

## Phase 2B — real discovery & deterministic eligibility

Pull real current postings, dedup them, apply deterministic rules, inspect a
shortlist. No LLM, no browser automation, no submission.

```bash
npm run discover      # fetch → normalize → dedup/store → deterministic eligibility
npm run shortlist     # eligible jobs (priority <=72h, then newest)
npm run cli -- review    # jobs needing human review (ambiguous)
npm run cli -- rejected  # rejected jobs grouped by reason
npm run cli -- job <id>  # one job + its sources + match result
```

### Sources

Pluggable via the `JobSourceAdapter` boundary (`src/sources/`) — the pipeline depends
only on the interface, never on a specific board. MVP sources, all legitimate public
JSON APIs (honest User-Agent, no anti-bot bypass, no auth):

- **Remotive** — global remote software roles (`candidate_required_location` gives a
  clean geo signal).
- **Arbeitnow** — European coverage incl. on-site/hybrid (exercises the location
  rules) and visa flags.
- **Jobicy** (`tag=react`) — remote frontend roles with geo + seniority signals
  (Europe / LATAM / worldwide).

### Ingestion & normalization

Each adapter returns `NormalizedJobCandidate[]` mapped to the `jobs` schema. Missing
fields stay `NULL` (never invented); free-text/foreign-currency salary is not parsed
or converted. Jobs are global and deduped by canonical URL; a posting found via
several sources becomes one job with multiple `job_sources`. Runs are idempotent.

### Deterministic eligibility

`src/eligibility/` reads the machine config `config/search-profile.json` (derived
from, and kept in sync with, `profile/search-rules.md`) and produces one of
**ELIGIBLE / INELIGIBLE / NEEDS_REVIEW** with structured reason codes:

- **Role/title:** frontend & frontend-heavy adjacent roles qualify; backend/data/QA/
  design/junior/pure-management are rejected; Staff and unclear scopes → review.
- **Freshness:** > 14 days → rejected; <=72h flagged priority; missing date never
  rejects on its own.
- **Location/work-auth:** Valencia & Switzerland (any mode) and remote
  Europe/worldwide qualify; explicit local-residency/US/Canada/UK-auth requirements
  are rejected; unclear international hiring → review.
- **Salary:** clearly-below-floor EUR/CHF annual → rejected; missing salary never
  rejects; foreign currency/ambiguous period is not guessed.

This is **hard eligibility only** — `fit_score` stays NULL until Phase 2C. Ambiguous
cases create a (deduped) review item rather than being dropped. No LLM is used.

## Roadmap (Phase 2C+, deferred)

Semantic/LLM fit scoring, application form filling, browser automation and
submission, cover-letter generation, reporting, and any hosted-product
infrastructure. None of it is built yet.
