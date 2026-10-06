# BLK-07: Inline editing: Editable primitive + TipTap in canvas
- Milestone: M3 (week 3)
- Depends on: XRP-01, BLK-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band C (see EXECUTION_PLAN.md "Bands")
## Goal
Edit text directly on the canvas instead of only in the sidebar.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: clicking a text element on the canvas makes it editable in place
- [ ] Draft: the edit saves to the same prop the sidebar edits
- [ ] Draft: rich text uses the same TipTap setup as `BLK-05`
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
An `Editable` primitive in `cms-blocks` that is inert on the public site.
