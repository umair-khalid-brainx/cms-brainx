# TYP-03: Type-driven routing
- Milestone: M3 (week 3)
- Depends on: TYP-01, CNT-07
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Entries of a new type are reachable on the public site at their prefix.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: `/<type prefix>/<slug>` renders a published entry
- [ ] Draft: no new route files or deploys are needed per type
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Extends `web/src/app/sites/[subdomain]/[[...path]]` and `findLiveByPath`.
