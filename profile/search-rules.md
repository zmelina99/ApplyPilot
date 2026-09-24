# search-rules.md — Job Search Rules

Defines which jobs ApplyPilot pursues, rejects, or routes to review. Deterministic
rules first; LLM judgment only where noted. Most values below are `[APPROVED]`.

Status: `APPROVED` = confirmed; `NEEDS_USER_INPUT` = still to provide.

> **Authoritative machine config:** this document is the human-readable source of
> truth for the search policy. The deterministic engine (Phase 2B) consumes a
> machine-readable projection of these rules at `config/search-profile.json`, which
> is **derived from this file**. When the policy changes, update this document and
> then update `config/search-profile.json` to match — they must not diverge, and the
> JSON is what the code reads.

---

## Primary goal

Find Frontend Engineering positions.  [APPROVED]

## Target titles  [APPROVED]

- Frontend Engineer
- Frontend Developer
- Senior Frontend Engineer
- React Engineer
- React Developer
- Software Engineer — Frontend
- UI Engineer
- Web Engineer / Web Developer
- Product Engineer — when frontend-heavy
- Full-Stack Engineer — when frontend-heavy
- Frontend Lead / Tech Lead — when still substantially hands-on

Use LLM judgment only to decide "frontend-heavy" / "substantially hands-on" for the
conditional titles; exact-title matches are deterministic.

## Seniority  [APPROVED]

- include: Mid, Senior, Lead (only if substantially hands-on)
- exclude: Intern, Junior, Principal, Engineering Manager / pure people-management
- staff: exclude UNLESS actual responsibilities are reasonably aligned with candidate
  experience (route ambiguous cases to review rather than auto-reject)

## Out-of-scope roles (hard reject)  [APPROVED]

- Backend-only
- Data Engineer
- QA-only
- Designer-only

## Years-of-experience handling  [APPROVED]

- Treat a role's years-of-experience requirement as a **fit signal**, not a hard gate.
- Do NOT auto-reject merely because a role asks for 5+ years and the candidate has 4+.
- Only treat as reject-worthy when the discrepancy is substantial OR the posting
  clearly frames the number as a hard eligibility requirement.

---

## Locations & remote  [APPROVED]

Search regions: Europe, Switzerland, United States, Canada, Latin America.

**Europe** (candidate may live anywhere in Europe) — eligible:
- Remote Europe / Remote EU / Remote EEA
- Remote EMEA when European residence is accepted
- Country-specific European remote jobs when the candidate is legally eligible
- Worldwide / fully-remote jobs

**United Kingdom** (treated separately from the Europe eligibility rule):
- Remote UK roles are eligible ONLY if the employer can hire the candidate
  internationally without requiring UK work authorization/residency (international
  contractor, EOR, global employment, or equivalent).
- Reject roles explicitly requiring UK residence or UK work authorization when no
  international hiring route exists.
- If UK hiring eligibility is unclear → escalate, do not assume.

**Hybrid / onsite:**
- Valencia, Spain: allowed
- Switzerland: allowed (relocation/onsite specifics open to discussion)
- Everywhere else: remote only

**Outside Europe / Switzerland / Argentina (US, Canada, other):**
- The role must permit performing the work while living outside that country via
  international remote employment, EOR, contracting, or freelancing — i.e. NO local
  work authorization/residency required.
- "Remote US" does NOT imply internationally remote — do not assume it does.
- Reject if the role explicitly requires local residence/work authorization and
  offers no international hiring path.

**Employment arrangements accepted** (any legitimate one): permanent employee,
fixed-term employee, EOR, contractor, independent contractor, freelancer, or other
legitimate cross-border arrangements.

**Relocation:** open to discussion. Do NOT state the candidate has committed to
relocate. Do NOT auto-reject a strong role because relocation is merely discussed —
only when relocation is explicitly mandatory AND conflicts with the rules above.

## Work authorization (reject logic)  [APPROVED]

- Europe / Switzerland / Argentina: do not reject on sponsorship/local-authorization
  grounds.
- United Kingdom: NOT covered by the Europe rule — hireable only via international
  arrangements with no UK work authorization/residency required (see UK block above).
- Outside those: candidate must be hireable remotely without local work authorization
  (international contractor, EOR, global employment, or equivalent).
- Reject if a role explicitly requires local (US/Canada/etc.) work authorization or
  residency and offers no international hiring route.
- If international hiring eligibility is ambiguous: do NOT assume — flag for review.
- Never infer legal work authorization from nationality.

---

## Salary rules  [APPROVED]

Numeric configuration (explicit fields; do not compute others at runtime):
- salary_floor_eur: 50000        # annual equivalent, general non-Swiss roles
- salary_target_eur: 60000       # annual equivalent
- salary_floor_chf: 85000        # annual equivalent, Swiss roles (hard reject below)
- salary_target_chf: 100000      # preferred / default numeric expectation for CH

Filtering:
- If advertised compensation is clearly below the applicable hard floor → reject.
- Do NOT reject Swiss roles between CHF 85k and CHF 100k — the floor is the reject
  threshold; the target is only the preferred/default expectation.
- If salary is not advertised → do NOT reject.
- Consider contract type when interpreting compensation; do not naively compare
  contractor gross vs. employee salary when arrangements differ materially.
- If the compensation structure makes comparison ambiguous → escalate, don't reject.
- Never disclose current/previous salary unless explicitly approved later.

(Application-form salary answers live in answers.md.)

---

## Job freshness  [APPROVED]

- max_job_age_days: 14
- prioritize_posted_within_hours: 72
- Do not auto-exclude a clearly exceptional, still-active match solely for being
  slightly older than 14 days.

## Application volume  [APPROVED]

- daily_application_cap: none
- Apply to every job passing eligibility + fit; not blind mass application — quality
  filters still apply.

---

## HARD ELIGIBILITY vs SKILL FIT  [APPROVED]

Two distinct concepts — never conflate:

- **HARD ELIGIBILITY** (deterministic, may reject): location/remote rules, work
  authorization rules, salary below floor, out-of-scope title/seniority, a skill the
  job clearly frames as fundamental/non-negotiable that the candidate lacks.
- **SKILL FIT** (scoring, never auto-rejects on its own): missing a required-but-not-
  fundamental technology lowers the fit score but does not reject. Example: a role
  wanting React + TypeScript + GraphQL + AWS is not auto-rejected just because the
  candidate lacks GraphQL/AWS, unless the posting presents them as non-negotiable.

## Preferred technologies (soft signal, boosts fit; never gates)  [APPROVED]

React, TypeScript, Next.js, Ionic/Capacitor, data-viz (D3/Recharts/Visx), Nx.

## Soft preferences (scoring only)

- company_size_preference: small teams (resume-stated)  [NEEDS_REVIEW]
- other_soft_preferences: NEEDS_USER_INPUT

## Search-profile scope  [APPROVED]

- profile_scope: Frontend employment ONLY. Do NOT add a Solutions Engineer /
  Implementation Engineer scoring bonus to this profile.
- future_profiles (architecture placeholder — do NOT implement now): the system
  should support additional, separate search profiles for Solutions Engineer,
  Implementation Engineer, Customer Engineer, and Forward-Deployed Engineer. These
  are not built and must not influence the current frontend profile's scoring.

---

## Human review & auto-apply gates  [APPROVED]

All autonomous submission is OFF until explicitly authorized (see below). Even the
architecture for it is Phase 2; nothing auto-submits now.

### A. Initial safety period
- The first 20 applications ApplyPilot prepares MUST stop before submit for candidate
  approval. Flow: Find → Filter → Analyze → Fill → STOP → candidate reviews →
  candidate approves → submit.
- Count only applications the candidate actually reviewed toward this calibration.
- After 20 reviewed applications, do NOT auto-enable autonomous submission. Enter a
  hard gate state: `AWAITING_AUTOMATION_APPROVAL`. Continue requiring approval until
  the candidate explicitly authorizes autonomous submission.

### B. Swiss applications
- Applications to Swiss companies / positions ALWAYS require human approval before
  submission — even after autonomous submission is enabled.

### C. Exceptional small-startup matches
- If a role is an exceptionally strong match AND the company appears to be a small
  startup → require human review before submission.
- Do not decide this on vague LLM intuition alone.
- Placeholders to configure later (do NOT invent thresholds now):
  - exceptional_match_threshold: NEEDS_USER_INPUT
  - small_startup_definition: NEEDS_USER_INPUT
- Until both are configured, if the system suspects this category applies →
  flag `MANUAL_REVIEW` rather than auto-submit.

### Never auto-submit (even after autonomous submission is approved)  [APPROVED]
Route to the appropriate review/escalation state if ANY apply:
- required information is missing
- an answer would require guessing
- work authorization is ambiguous
- international hiring eligibility is ambiguous
- a mandatory salary input cannot be answered by the approved rules
- the application contains a question unsupported by the profile
- a CAPTCHA requires manual intervention
- login / account creation requires user action
- the system is uncertain whether submission would be truthful
- the Swiss review rule applies
- the exceptional-small-startup review rule applies

## Auto-apply criteria (Phase 2+, disabled)

- auto_apply_enabled: false  [locked until explicit authorization]
- min_fit_score_to_auto_apply: NEEDS_USER_INPUT
- require_all_hard_eligibility_met: true  [APPROVED]
