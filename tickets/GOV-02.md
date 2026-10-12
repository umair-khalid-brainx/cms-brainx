# GOV-02: Revision comparison, block level
- Milestone: M4 (week 4)
- Depends on: GOV-01, BLK-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.50 days, band C (see EXECUTION_PLAN.md "Bands")
## Goal
Compare two revisions block by block.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [x] Pick two revisions (default: the selected one and the current version) and see blocks marked Added, Removed, Changed or Unchanged (collapsed)
- [x] Blocks are matched by sequence, since saved blocks carry no id; the stored block contract is not changed
- [x] Changed props show old → new; rich text shows word-level changes
- [x] Title, field values and SEO changes show above the blocks
- [x] The older side can be restored from the compare screen
- [x] All tests pass. Reviewer approved. Verifier passed. (2026-10-12; review fixes: formatting-only edits show as Changed, restore dialog clears a stale error, Compare disabled while edits are unsaved, notice for an unknown id in the link, LCS trims the common start and end)
## Technical notes
Depends on `GOV-01` and the block contract in `cms-blocks/src/types.ts`.
