# ApplyPilot

A personal, autonomous job-application agent. It discovers frontend engineering
roles, filters them against the candidate's rules, analyzes fit, and (eventually)
applies — using **only verified candidate information** and escalating anything it
cannot answer confidently.

> **Status: Phase 1 — profile setup.** No automation is built yet. This repo
> currently holds the project structure and the candidate source of truth.

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
├── .env.example         # Template of personal-data keys (copy to .env, gitignored)
├── profile/             # Candidate source of truth (data, not logic)
│   ├── candidate.md     # Identity, contact, location, work auth, languages, links
│   ├── experience.md    # Authoritative record of experience & skill levels
│   ├── search-rules.md  # What jobs to pursue / reject; auto-apply criteria
│   └── answers.md       # Reusable, status-tagged answer bank for forms
├── resumes/             # Resume/CV files to attach to applications
└── data/                # Job + application records (state; populated in Phase 2)
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

## Roadmap

Phase 2+ will add: daily job discovery, deduplication, deterministic filtering, fit
analysis, form filling, escalation, tracking, and a daily report. None of it runs
until the profile is complete.
