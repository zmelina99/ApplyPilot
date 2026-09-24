# data/

State store for ApplyPilot: records of every job discovered and every application
submitted. **Empty in Phase 1** — populated once automation is built in Phase 2.

Planned contents (Phase 2+), kept auditable:
- discovered jobs (with source, timestamp, and a stable dedup key)
- per-job processing decisions (filter result, fit analysis, reasoning trace)
- submitted applications (what was sent, sourced to `/profile`, and when)
- escalation queue (items needing user input)

Design intent: every record must be traceable back to the inputs and rules that
produced it (see CLAUDE.md, rule 9). No records exist yet.
