# DEP-01b: Deploy script, three-app topology, rollback
- Milestone: M5 (week 5)
- Depends on: DEP-01a
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.80 days, band E (see EXECUTION_PLAN.md "Bands")
## Goal
A repeatable deploy script for all three apps, with rollback.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: one command deploys api, web and admin
- [ ] Draft: database migrations run as part of deploy
- [ ] Draft: a failed deploy can be rolled back to the previous release
- [ ] Draft: production API subdomain and port decided (DEC-5)
## Technical notes
Depends on `DEP-01a`. Revisit `npm audit` findings before this (`BACKLOG.md` B-08).
