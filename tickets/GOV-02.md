# GOV-02: Revision comparison, block level
- Milestone: M4 (week 4)
- Depends on: GOV-01, BLK-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.50 days, band C (see EXECUTION_PLAN.md "Bands")
## Goal
Compare two revisions block by block.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: pick two revisions and see added, removed and changed blocks
- [ ] Draft: changed props within a block are highlighted
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Depends on `GOV-01` and the block contract in `cms-blocks/src/types.ts`.
