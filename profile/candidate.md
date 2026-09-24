# candidate.md — Identity & Contact (Source of Truth)

Structured factual information about the candidate.

**Privacy:** this repo is public, so personal identifiers are NOT stored here. They
live in a local, gitignored `.env` file (see `.env.example` for the keys). Fields
below reference `${ENV_KEY}` — the agent resolves the real value from `.env` at
runtime. Non-identifying facts (work authorization, language levels, summary) are
kept inline.

Status tags apply to the value in `.env` (or inline):
- `NEEDS_REVIEW` = drafted from the resume; confirm or correct.
- `NEEDS_USER_INPUT` = not yet provided (the `.env` value is still `NEEDS_USER_INPUT`).
- `APPROVED` = confirmed; only APPROVED values may be submitted.

## Identity  (values in .env)

- full_name: ${CANDIDATE_FULL_NAME}  [NEEDS_REVIEW]
- preferred_name: ${CANDIDATE_PREFERRED_NAME}  [NEEDS_USER_INPUT]
- pronouns: ${CANDIDATE_PRONOUNS}  [NEEDS_USER_INPUT]
- date_of_birth: ${CANDIDATE_DOB}  [NEEDS_REVIEW]
  - note: On the resume but rarely required — and often better omitted — on
    applications. Use only when a form explicitly asks.
- nationality: ${CANDIDATE_NATIONALITY}  [NEEDS_REVIEW]

## Contact  (values in .env)

- email: ${CANDIDATE_EMAIL}  [NEEDS_REVIEW]
- phone: ${CANDIDATE_PHONE}  [NEEDS_USER_INPUT]
- preferred_contact_method: ${CANDIDATE_PREFERRED_CONTACT}  [NEEDS_USER_INPUT]

## Location  (values in .env)

- current_city: ${CANDIDATE_CURRENT_CITY}  [NEEDS_USER_INPUT]
  - note: The resume shows the most recent role as "Ticino, Switzerland – Remote,"
    but does not state current residence. Do not assume.
- current_country: ${CANDIDATE_CURRENT_COUNTRY}  [NEEDS_USER_INPUT]
- timezone: ${CANDIDATE_TIMEZONE}  [NEEDS_USER_INPUT]
- open_to_relocation: NEEDS_USER_INPUT   # see search-rules.md for target locations

## Work authorization

Do not infer authorization from nationality. State it explicitly per region.
(Kept inline — not a personal identifier.)

- authorized_switzerland: NEEDS_USER_INPUT
- authorized_eu: NEEDS_USER_INPUT
- authorized_uk: NEEDS_USER_INPUT
- authorized_us: NEEDS_USER_INPUT
- authorized_argentina: NEEDS_USER_INPUT
- requires_visa_sponsorship: NEEDS_USER_INPUT   # per region; note exceptions below
- work_auth_notes: NEEDS_USER_INPUT

## Languages

- spanish: Native  [NEEDS_REVIEW]
- english: C2 (Bilingual)  [NEEDS_REVIEW]
- french: B1 (Intermediate)  [NEEDS_REVIEW]
- german: NEEDS_USER_INPUT
  - note: Not listed on the resume. Relevant for many Swiss roles — confirm level or
    mark "none."
- other_languages: NEEDS_USER_INPUT

## Links  (values in .env)

- portfolio: ${CANDIDATE_PORTFOLIO_URL}  [NEEDS_REVIEW]
- linkedin_url: ${CANDIDATE_LINKEDIN_URL}  [NEEDS_USER_INPUT]
  - note: Resume shows a LinkedIn display name but not the profile URL slug. Provide
    the full URL in `.env`.
- github_url: ${CANDIDATE_GITHUB_URL}  [NEEDS_USER_INPUT]
  - note: Resume shows the handle "zmelina99." Confirm the full URL
    (e.g. https://github.com/zmelina99) in `.env`.
- personal_website: ${CANDIDATE_PERSONAL_WEBSITE}  [NEEDS_USER_INPUT]

## Professional summary

Verified summary as written by the candidate on the resume [NEEDS_REVIEW]:

> Full-stack engineer with 4+ years building scalable web and mobile products for
> international environments. At Hive Power I grew from individual contributor to
> technical lead — owning architecture, setting engineering standards, and shipping
> a multi-tenant whitelabeled platform that cut partner onboarding time by 5×. I
> bring strong product instincts, cross-functional communication, and a practical
> AI-first development workflow. I write clean, testable code and thrive in small
> teams where technical decisions have direct business impact.

- headline_current: Full-Stack Engineer (Frontend Lead)  [NEEDS_REVIEW]
- headline_target: NEEDS_USER_INPUT
  - note: The stated goal is to keep applying to Frontend Engineer roles now while
    transitioning toward Solutions / Implementation Engineering. Confirm the headline
    ApplyPilot should present for the current frontend search.
