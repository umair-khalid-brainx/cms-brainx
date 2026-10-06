# CNT-10: Duplicate page
- Milestone: M2 (week 2)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.15 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Duplicate an existing page as a new draft.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: a Duplicate action on the Pages list creates a copy with the same blocks
- [ ] Draft: the copy is a draft with a unique slug (e.g. `about-copy`)
- [ ] Draft: duplicating never crosses sites
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`ContentService`, `PagesListPage.tsx`.
