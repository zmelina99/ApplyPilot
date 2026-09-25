# resumes/

Resume/CV files to attach to applications. Nothing is auto-selected yet.

Add your file(s) here, e.g. `Melina-Zellweger-Frontend-Engineer.pdf`. In Phase 2 the
agent will pick the appropriate resume to attach; for now this folder just holds the
source documents.

Guidance:
- Keep filenames descriptive (role focus + name).
- If you keep multiple variants (e.g. frontend vs. full-stack), note which is the
  default here.

**Approved default:** set `resume.defaultFile` in `config/application-defaults.json`
to the filename (not a path). ApplyPilot uses that file only when it exists in this
folder. If `defaultFile` is `null` or the file is missing, preparation marks the
resume as unavailable — it never guesses a path.

Personal resume files in this folder are gitignored; only this README is committed.
