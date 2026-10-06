# CNT-05: Page hierarchy: parent, depth limit, cycle guard
- Milestone: M1 (week 1)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Pages can have a parent page, with a depth limit and no cycles.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: `Content` has an optional `parentId` within the same site
- [ ] Draft: a page can't be its own ancestor (cycle guard); attempt returns 400
- [ ] Draft: nesting deeper than the agreed limit is refused
- [ ] Draft: a parent from another site is refused
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Schema migration on `content`; `ContentRepository`, `ContentService`. Depth limit value to confirm.
