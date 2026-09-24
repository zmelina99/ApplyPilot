# answers.md — Application Answer Bank

Reusable answers for common application questions. The agent may use an answer in a
submitted application **only when its Status is `APPROVED`**. Anything else must be
escalated, never guessed.

Format:

```
### QUESTION / CATEGORY
Answer: ...
Status: APPROVED | NEEDS_USER_INPUT | NEEDS_REVIEW
Notes: ...
```

- `APPROVED` = verified; safe to submit.
- `NEEDS_REVIEW` = drafted from the resume; confirm to promote to APPROVED.
- `NEEDS_USER_INPUT` = unknown; must be provided before any use.

---

### Work authorization
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: State per region (Switzerland / EU / UK / US / Argentina). Dual
Swiss–Argentinian nationality is verified, but authorization to work in any specific
country must be stated explicitly in candidate.md — do not infer it from nationality.

### Visa sponsorship — do you require it?
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Per region. Forms usually ask yes/no for the role's country.

### Salary expectations
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Provide currency, a target/range, and a hard floor. The floor feeds
search-rules.md (`min_salary_below_floor`). Consider separate numbers by
market/currency (CHF, EUR, USD) if relevant.

### Notice period / availability to start
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: e.g. "Immediately," "2 weeks," "1 month." Resume shows the last role ending
2025-12; confirm current employment/availability.

### Willingness to relocate
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Yes/no, and to where. Keep consistent with search-rules.md.

### Preferred work arrangement (remote / hybrid / onsite)
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Keep consistent with search-rules.md remote_requirement.

### Current location
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Pull from candidate.md once provided.

### Years of professional experience (overall)
Answer: "4+ years" (candidate's resume summary)
Status: NEEDS_REVIEW
Notes: Confirm exact figure. For per-technology years, see experience.md — never
infer those.

### Years of experience with [specific technology]
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Resolve per technology from experience.md. If the `years` field there is
NEEDS_USER_INPUT, escalate — do not compute from role dates.

### Languages spoken
Answer: Spanish (Native), English (C2 / Bilingual), French (B1 / Intermediate)
Status: NEEDS_REVIEW
Notes: Verified on resume. German not listed — confirm level or "none" in candidate.md.

### LinkedIn profile
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Resume shows display name only; provide the full URL.

### Portfolio / personal website
Answer: ${CANDIDATE_PORTFOLIO_URL}   # value in .env
Status: NEEDS_REVIEW
Notes: From resume. Confirm it's current and the one to submit.

### GitHub profile
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Resume shows handle "zmelina99"; confirm the full URL.

### Email
Answer: ${CANDIDATE_EMAIL}   # value in .env
Status: NEEDS_REVIEW
Notes: From resume. Confirm this is the address to use on applications.

### Phone number
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Not on resume.

### Highest level of education
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Resume lists Henry Bootcamp (Full Stack Developer) and a secondary school
diploma; no university degree is listed. Confirm what to state.

### How did you hear about us?
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Suggested reusable default e.g. "Online job board" — confirm.

### Why do you want to work here? (cover letter / free text)
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Per-company and judgment-based — must be generated from job + verified profile
facts and escalated for review before submission, never auto-filled from assumptions.

---

## Demographic / voluntary (EEO) questions

Optional on most forms. Default to "Decline to self-identify" unless the candidate
sets a value. Nothing here is used unless Status is APPROVED.

### Gender
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Or set to "Decline to self-identify."

### Race / ethnicity
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Or "Decline to self-identify."

### Veteran status
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Or "Decline to self-identify." Often US-specific.

### Disability status
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Or "Decline to self-identify."

### Default for any voluntary demographic question
Answer: Decline to self-identify
Status: NEEDS_USER_INPUT
Notes: Confirm you want this as the blanket default for optional EEO fields.
