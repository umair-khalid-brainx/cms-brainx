# GOV-02: Revision comparison, block level
- Milestone: M4 (week 4)
- Depends on: GOV-01, BLK-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.50 days, band C (see EXECUTION_PLAN.md "Bands")
## Goal
Compare two revisions block by block.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [ ] Pick two revisions (default: the selected one and the current version) and see blocks marked Added, Removed, Changed or Unchanged (collapsed)
- [ ] Blocks are matched by sequence, since saved blocks carry no id; the stored block contract is not changed
- [ ] Changed props show old → new; rich text shows word-level changes
- [ ] Title, field values and SEO changes show above the blocks
- [ ] The older side can be restored from the compare screen
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Depends on `GOV-01` and the block contract in `cms-blocks/src/types.ts`.
