# TYP-01: Type builder UI
- Milestone: M3 (week 3)
- Depends on: CNT-02
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.40 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Admins create a new content type (e.g. Events) live, with no deploy.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: a Types screen lists and creates content types with a name and URL prefix
- [ ] Draft: types belong to one site
- [ ] Draft: a new type appears in the admin navigation immediately
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Content `type` discriminator (ARCHITECTURE.md "Content model").
