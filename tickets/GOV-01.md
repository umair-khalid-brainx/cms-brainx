# GOV-01: Revisions: snapshot, list, restore
- Milestone: M4 (week 4)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Every save keeps a revision that can be listed and restored.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: saving a page snapshots its title and blocks
- [ ] Draft: admin lists a page's revisions with time and author
- [ ] Draft: restoring a revision makes it the current content (as a draft)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
New `revisions` table, scoped through the repository layer.
