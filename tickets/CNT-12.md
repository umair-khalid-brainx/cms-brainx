# CNT-12: Pre-publish validation
- Milestone: M2 (week 2)
- Depends on: CNT-03
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Publishing is refused when a page has problems a visitor would see.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: publish is blocked with a clear message if required block fields are empty
- [ ] Draft: the check runs in the API, not only in the editor
- [ ] Draft: saving a draft is never blocked by these checks
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Which rules count as "problems" needs agreeing first. `ContentService.update` on transition to `published`.
