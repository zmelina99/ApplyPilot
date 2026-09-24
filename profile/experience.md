# experience.md — Authoritative Experience Record

**This file is the ONLY source from which ApplyPilot may make claims about the
candidate's professional experience or technical capability.** If a claim can't be
grounded in this file, the system must not make it.

Status tags:
- `NEEDS_REVIEW` = drafted verbatim/derived from the resume; confirm or correct.
- `NEEDS_USER_INPUT` = not stated on the resume; must be provided.

Never infer years of experience. Years are `NEEDS_USER_INPUT` unless explicitly
written here by the candidate.

---

## Summary metrics

- self_reported_total_experience: "4+ years" (candidate's resume summary)  [NEEDS_REVIEW]
- earliest_professional_dev_role: 2021-07 (ClearMix)  [NEEDS_REVIEW]
- currently_employed: NEEDS_USER_INPUT   # most recent role ended 2025-12 per resume
- current_availability / notice: NEEDS_USER_INPUT   # see answers.md

---

## Roles

### Role 1 — Full-Stack Engineer (Frontend Lead) — Hivepower  [NEEDS_REVIEW]

- company: Hivepower (Hive Power)
- title: Full-Stack Engineer (Frontend Lead)
- start: 2023-02
- end: 2025-12
- location: Ticino, Switzerland — Remote
- employment_type: NEEDS_USER_INPUT   # full-time / contract?
- highlights (from resume):
  - Built a React + Ionic/Capacitor app from scratch (Nx monorepo) targeting web,
    iOS, and Android; scaled from 1 to 5+ enterprise clients via a whitelabeling
    framework (isolated brand themes, configurable feature flags, i18n), cutting
    partner onboarding time ~5×.
  - Architected a modular KPI widget system with complex data visualizations (D3,
    Recharts, Visx), reducing per-client custom work ~40% on a single shared codebase.
  - Defined frontend architecture, accessibility standards (WCAG), and testing
    practices, reducing UI bug count and improving cross-browser/device stability.
  - Drove design↔backend alignment, cutting feature delivery cycles ~50%.
  - Contributed to FastAPI backend services and Kubernetes deployment pipelines
    (Docker, Google Cloud Platform).
  - Integrated AI-assisted workflows (Copilot, code generation) for refactoring, test
    scaffolding, and design-to-code conversion.

### Role 2 — Frontend Engineer — ClearMix  [NEEDS_REVIEW]

- company: ClearMix
- title: Frontend Engineer
- start: 2021-07
- end: 2022-12
- location: New York, USA — Remote
- employment_type: NEEDS_USER_INPUT
- highlights (from resume):
  - Led development of ClearMix Logistics (Next.js + Google Maps API): a responsive
    web app for real-time scheduling and routing of mobile studio deliveries.
  - Helped architect a virtual recording studio platform with cloud sync, reducing
    failed recordings ~65%.
  - Co-built ClearMix Intros, a video-personalization feature (PLG-driven acquisition).
  - Raised test coverage to ~70% via unit/integration tests (Jest/Cypress).
  - Promoted engineering culture through code reviews, patterns, and documentation.

### Role 3 — Full Stack Developer (training) — Henry Bootcamp  [NEEDS_REVIEW]

- company: Henry Bootcamp
- role: Full Stack Developer (program) + Teaching Assistant
- dates: 2021-02 – 2021-06 (bootcamp); 2021-04 – 2021-06 (TA)
- location: Remote
- note: Full-stack development training; also served as teaching assistant.

### Non-software work experience (context, not dev experience)  [NEEDS_REVIEW]

Listed on the resume; not software experience. Retained for gaps/context only — the
system must not present these as engineering experience.
- Ski Instructor — Leysin Ecole de ski (2023-12 – 2024-04), Leysin, Switzerland
- Scuba Diving Instructor — Dressel Divers International (2019-10 – 2020-03), Punta Cana, DR
- Coffee Shop Manager — Leysin American School (2018-09 – 2019-06), Leysin, Switzerland

---

## Education  [NEEDS_REVIEW]

- Full Stack Developer — Henry Bootcamp (2021-02 – 2021-06), Remote
- Secondary School Diploma, Bachillerato en Ciencias Sociales —
  Instituto Parroquial Sagrada Familia (2012–2016), Buenos Aires, Argentina
- highest_degree: NEEDS_USER_INPUT   # confirm whether any university degree exists;
  none is listed on the resume. Many forms ask "highest degree."

---

## Certifications & achievements  [NEEDS_REVIEW]

- Certified PADI Scuba Diving Instructor
- Certified Ski Instructor
- Qualified for Swiss National Championship in Olympic Weightlifting (2026)
- Argentine champion, Roller Figure Skating (2011)
- relevant_technical_certifications: NEEDS_USER_INPUT   # any dev/cloud certs?

---

## Skill matrix

Resume-stated proficiency is captured in `resume_level`. The **experience_type** and
**years** fields govern what the system may claim and must be confirmed.

- `experience_type`: `production` | `personal` | `theoretical` | `none`
- `years`: NEEDS_USER_INPUT everywhere unless the candidate writes a number.
  Do not infer years from role dates.

Drafted `experience_type` values below are marked `[NEEDS_REVIEW]` when a resume
bullet shows the tech used in a paid role; otherwise `NEEDS_USER_INPUT`.

| Technology            | resume_level | experience_type            | years            |
| --------------------- | ------------ | -------------------------- | ---------------- |
| JavaScript            | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| TypeScript            | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| HTML5                 | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| CSS3                  | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| SCSS                  | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| React.js              | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Redux                 | Advanced     | NEEDS_USER_INPUT           | NEEDS_USER_INPUT |
| Next.js               | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Ionic                 | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Capacitor             | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| D3                    | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Recharts              | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Visx                  | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Git                   | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| GitHub                | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Nx Monorepo           | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Vite                  | Advanced     | NEEDS_USER_INPUT           | NEEDS_USER_INPUT |
| Webpack               | Advanced     | NEEDS_USER_INPUT           | NEEDS_USER_INPUT |
| Xcode                 | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| AI code generation    | Advanced     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Node.js               | Intermediate | NEEDS_USER_INPUT           | NEEDS_USER_INPUT |
| Express               | Intermediate | NEEDS_USER_INPUT           | NEEDS_USER_INPUT |
| Sequelize             | Intermediate | NEEDS_USER_INPUT           | NEEDS_USER_INPUT |
| PostgreSQL            | Intermediate | NEEDS_USER_INPUT           | NEEDS_USER_INPUT |
| Firebase              | Intermediate | NEEDS_USER_INPUT           | NEEDS_USER_INPUT |
| Supabase              | Intermediate | NEEDS_USER_INPUT           | NEEDS_USER_INPUT |
| Docker                | Intermediate | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Jest                  | Intermediate | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Cypress               | Intermediate | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Storybook             | Intermediate | NEEDS_USER_INPUT           | NEEDS_USER_INPUT |
| Figma                 | Intermediate | NEEDS_USER_INPUT           | NEEDS_USER_INPUT |
| Android Studio        | Intermediate | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| REST APIs             | Intermediate | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| i18n                  | Intermediate | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Python                | Beginner     | NEEDS_USER_INPUT           | NEEDS_USER_INPUT |
| FastAPI               | Beginner     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Google Cloud Platform | Beginner     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |
| Kubernetes            | Beginner     | production [NEEDS_REVIEW]   | NEEDS_USER_INPUT |

Additional skills not on the resume: NEEDS_USER_INPUT
(e.g. Vue, Angular, Svelte, Tailwind, GraphQL, Playwright, Vitest, testing-library,
CI/CD, AWS/Azure — add only if true.)
