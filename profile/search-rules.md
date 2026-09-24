# search-rules.md — Job Search Rules

Defines which jobs ApplyPilot pursues, rejects, or auto-applies to. Deterministic
rules first; LLM judgment only where noted.

Status tags: `NEEDS_USER_INPUT` = must be provided; `NEEDS_REVIEW` = suggested
default drafted from context, confirm or change. Bracketed defaults are suggestions,
not decisions.

---

## Target titles (primary)

Roles to actively search for.  [NEEDS_REVIEW — confirm/trim]
- Frontend Engineer
- Frontend Developer
- Senior Frontend Engineer   # include only if seniority (below) allows
- React Engineer / React Developer
- confirm_or_edit: NEEDS_USER_INPUT

## Acceptable adjacent titles

Match if frontend-heavy; use LLM judgment on ambiguous ones.  [NEEDS_REVIEW]
- Full-Stack Engineer (frontend-leaning)
- Web Engineer / Web Developer
- UI Engineer
- Software Engineer (Frontend)
- Product Engineer (frontend-leaning)
- confirm_or_edit: NEEDS_USER_INPUT

## Explicitly out-of-scope titles

Titles to ignore even if they mention frontend.  [NEEDS_USER_INPUT]
- suggested to consider excluding: Backend Engineer, Data Engineer, pure Designer,
  Engineering Manager, QA-only. Confirm.

## Locations & remote

- remote_requirement: NEEDS_USER_INPUT   # remote-only | hybrid-ok | onsite-ok
- acceptable_countries: NEEDS_USER_INPUT
  - note: Prior roles were remote for Swiss and US companies. Which countries'
    companies are acceptable now? Tie this to work authorization in candidate.md.
- acceptable_timezones: NEEDS_USER_INPUT   # e.g. Europe / CET ± N hours
- onsite_cities_ok: NEEDS_USER_INPUT
- relocation_ok: NEEDS_USER_INPUT   # and to where, if yes

## Seniority

- target_levels: NEEDS_USER_INPUT   # e.g. mid / senior
  - note: Resume shows ~4+ years and a "Frontend Lead" role. Confirm whether to
    include Senior/Lead, and whether to exclude Junior/Intern.
- exclude_levels: NEEDS_USER_INPUT   # e.g. Intern, Junior, Manager/EM
- accept_lead_or_manager_titles: NEEDS_USER_INPUT

## Preferred technologies (soft signal, not gating)

Presence boosts fit score; absence never rejects.  [NEEDS_REVIEW]
- React, TypeScript, Next.js, Ionic/Capacitor, data-viz (D3/Recharts/Visx), Nx
- add/remove: NEEDS_USER_INPUT

## Hard rejection criteria (deterministic — any match rejects)

Confirm each. Suggested candidates marked, but nothing here is active until approved.
- work_authorization_not_met: reject if the role's country isn't authorized in
  candidate.md AND the role won't sponsor.  [NEEDS_REVIEW]
- remote_policy_mismatch: reject if onsite-only and candidate is remote-only.  [NEEDS_USER_INPUT]
- seniority_mismatch: reject titles below/above target levels.  [NEEDS_USER_INPUT]
- min_salary_below_floor: reject if stated salary below floor (see answers.md).  [NEEDS_USER_INPUT]
- required_language_not_met: reject if a language is REQUIRED at a level the
  candidate lacks (e.g. German-required roles).  [NEEDS_USER_INPUT]
- excluded_companies: NEEDS_USER_INPUT   # blocklist (e.g. current/former employers)
- excluded_industries: NEEDS_USER_INPUT   # e.g. gambling, defense — if any
- required_stack_absent: reject only if a REQUIRED core skill is `none` in
  experience.md (never for PREFERRED).  [NEEDS_REVIEW]
- other_hard_rejects: NEEDS_USER_INPUT

## Soft preferences (scoring, not gating)

Adjust fit score; never reject on their own.  [NEEDS_USER_INPUT]
- company_size_preference: NEEDS_USER_INPUT   # resume notes thriving in small teams
- industry_interests: NEEDS_USER_INPUT
- mission/product_preferences: NEEDS_USER_INPUT
- tech_culture_signals: NEEDS_USER_INPUT   # e.g. testing culture, design maturity
- solutions/implementation-adjacent_bonus: NEEDS_USER_INPUT
  - note: Stated long-term goal is a move toward Solutions/Implementation
    Engineering. Should such-adjacent frontend roles score higher?

## Job-age limits

- max_job_age_days: NEEDS_USER_INPUT   # suggested default: 14
- reprocess_reposted_jobs: NEEDS_USER_INPUT   # yes/no

## Auto-apply criteria (eventual — Phase 2+, disabled for now)

All auto-apply is OFF until explicitly enabled. Define the bar for later.
- auto_apply_enabled: false  [locked until Phase 2]
- min_fit_score_to_auto_apply: NEEDS_USER_INPUT   # e.g. 0.85 on a 0–1 scale
- require_all_required_skills_present: NEEDS_USER_INPUT   # suggested: true
- max_auto_applies_per_day: NEEDS_USER_INPUT
- never_auto_apply_if_form_has_unanswerable_question: NEEDS_USER_INPUT   # suggested: true
- always_escalate_before_apply_when: NEEDS_USER_INPUT
  - suggested: any `NEEDS_USER_INPUT` field is touched, salary is required and no
    floor is set, or a cover letter / free-text essay is required.
- require_human_approval_before_first_N_applies: NEEDS_USER_INPUT   # suggested: true
