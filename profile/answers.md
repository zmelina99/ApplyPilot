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
Answer: Eligible to work across Europe, Switzerland, and Argentina without
sponsorship. For roles based elsewhere, available via international remote
arrangements (EOR, contractor, freelance) that do not require local work
authorization.
Status: APPROVED
Notes: Do not infer legal authorization from nationality. Reject/route logic for
specific countries lives in search-rules.md. If a form asks "authorized to work in
<country>?" for a country outside EU/CH/AR with no international route, escalate.

### Visa sponsorship — do you require it?
Answer: No sponsorship needed for Europe, Switzerland, or Argentina. For other
countries, works via international remote arrangements rather than local sponsorship.
Status: APPROVED
Notes: Per region. If a mandatory yes/no can't be answered truthfully under these
rules, escalate.

### Salary expectations
Answer: See numeric config fields below; default free-text = "Negotiable based on the
scope of the role, total compensation, and employment arrangement."
Status: APPROVED
Notes:
- Optional field → leave blank.
- Mandatory free-text → use the negotiable statement above.
- Mandatory numeric → use the market-specific value below (never invent one).
- Non-EUR/CHF currency, or ambiguous period (monthly/hourly/daily) → escalate; do NOT
  convert or guess until deterministic conversion is implemented.
- Never disclose current/previous salary unless explicitly approved later.

#### Salary numeric config (explicit; do not compute others at runtime)
- salary_numeric_eur: 60000    # European / non-Swiss mandatory numeric expectation  [APPROVED]
- salary_numeric_chf: 100000   # Swiss mandatory numeric expectation (target; never below 85000)  [APPROVED]
- salary_floor_eur: 50000  [APPROVED]   # see search-rules.md
- salary_floor_chf: 85000  [APPROVED]   # hard reject below; do not reject 85k–100k
- salary_numeric_other_currency: escalate  [APPROVED]

### Notice period / availability to start
Answer: Immediately.
Status: APPROVED
Notes: Candidate is currently available to start immediately.

### Willingness to relocate
Answer: Open to discussion.
Status: APPROVED
Notes: Not a commitment to relocate. Keep consistent with search-rules.md.

### Preferred work arrangement (remote / hybrid / onsite + contract type)
Answer: Remote (Europe-wide/worldwide); hybrid acceptable in Valencia, Spain; onsite
in Switzerland open to discussion. Open to any legitimate arrangement — permanent,
fixed-term, EOR, contractor, independent contractor, or freelance.
Status: APPROVED
Notes: Keep consistent with search-rules.md location & arrangement rules.

### Current location
Answer: ${CANDIDATE_CURRENT_CITY}, ${CANDIDATE_CURRENT_COUNTRY}   # values in .env
Status: NEEDS_USER_INPUT
Notes: Not yet provided in .env.

### Years of professional experience (overall)
Answer: 4+ years (integer form: 4)
Status: APPROVED
Notes: For per-technology years, see experience.md — never infer those.

### Years of experience with [specific technology]
Answer: React 4, TypeScript 4, JavaScript 4, Next.js 4, HTML 4, CSS 4. Other
production technologies: professional experience confirmed but no number provided.
Status: APPROVED
Notes: For a production technology whose `years` is NEEDS_USER_INPUT in experience.md,
you may state professional experience but must escalate if a numeric year count is
mandatory. For no-experience technologies (see experience.md), answer none / do not
claim.

### Languages spoken
Answer: Spanish (Native), English (C2 / Bilingual), French (B1 / Intermediate)
Status: APPROVED
Notes: German not confirmed — see candidate.md (NEEDS_USER_INPUT). Do not claim German.

### LinkedIn profile
Answer: ${CANDIDATE_LINKEDIN_URL}   # value in .env
Status: NEEDS_USER_INPUT
Notes: Provide the full URL in .env.

### Portfolio / personal website
Answer: ${CANDIDATE_PORTFOLIO_URL}   # value in .env
Status: NEEDS_REVIEW
Notes: From resume. Confirm it's current and the one to submit.

### GitHub profile
Answer: ${CANDIDATE_GITHUB_URL}   # value in .env
Status: NEEDS_USER_INPUT
Notes: Resume shows handle "zmelina99"; confirm the full URL in .env.

### Email
Answer: ${CANDIDATE_EMAIL}   # value in .env
Status: NEEDS_REVIEW
Notes: From resume. Confirm this is the address to use on applications.

### Phone number
Answer: ${CANDIDATE_PHONE}   # value in .env
Status: NEEDS_USER_INPUT
Notes: Not yet provided in .env.

### Highest level of education
Answer: No university degree. Highest formal academic education: Secondary School
Diploma (Bachillerato en Ciencias Sociales). Additional professional education: Henry
Full Stack Developer Bootcamp.
Status: APPROVED
Notes: Answer truthfully; never imply the bootcamp is a university degree.

### How did you hear about us?
Answer: NEEDS_USER_INPUT
Status: NEEDS_USER_INPUT
Notes: Suggested reusable default e.g. "Online job board" — confirm.

### Why do you want to work here? / cover letters / free-text questions
Answer: Generated per job (auto-generation allowed).
Status: APPROVED
Notes: May be generated automatically. Every factual claim about the candidate MUST be
grounded in experience.md. May use the job description, public factual company info,
verified experience, and verified preferences. May NOT invent enthusiasm,
technologies, accomplishments, customer experience, motivations-as-fact, or years of
experience. Keep answers concise and natural. No human approval required unless a
review rule in search-rules.md applies.

---

## Demographic / voluntary (EEO) questions  [APPROVED default]

When a voluntary demographic/EEO question offers an option equivalent to "Decline to
self-identify" / "Prefer not to say" / "I do not wish to answer", select it. Do not
infer demographic information. If declining is impossible and an answer is mandatory,
escalate.

### Gender
Answer: Decline to self-identify
Status: APPROVED
Notes: Escalate if no decline option and answer is mandatory.

### Race / ethnicity
Answer: Decline to self-identify
Status: APPROVED
Notes: Escalate if no decline option and answer is mandatory.

### Veteran status
Answer: Decline to self-identify
Status: APPROVED
Notes: Escalate if no decline option and answer is mandatory.

### Disability status
Answer: Decline to self-identify
Status: APPROVED
Notes: Escalate if no decline option and answer is mandatory.
