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
- open_to_relocation: Open to discussion — not committed  [APPROVED]   # see search-rules.md
- availability_to_start: Immediate  [APPROVED]

## Work authorization

Confirmed eligibility policy. Do not infer legal authorization from nationality;
these are the candidate's approved filtering rules (reject logic in search-rules.md).

- eligible_europe: Yes — no sponsorship concern  [APPROVED]
- eligible_switzerland: Yes — no sponsorship concern  [APPROVED]
- eligible_argentina: Yes — no sponsorship concern  [APPROVED]
- united_kingdom: Treated separately from Europe — eligible only via international
  arrangements (EOR, contractor, freelance) with no UK work authorization/residency
  required  [APPROVED]
- outside_europe_ch_ar: Hireable only via international remote arrangements (EOR,
  contractor, freelance) that require no local work authorization/residency  [APPROVED]
- reject_if: role requires local work authorization/residency (e.g. US/Canada/UK) and
  offers no international hiring route  [APPROVED]
- if_international_eligibility_ambiguous: do not assume — flag for review  [APPROVED]

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
- headline_target: Frontend Engineer  [APPROVED]
  - note: Headline ApplyPilot presents for the current frontend search. Historical
    role titles in experience.md are unchanged and must not be rewritten.
