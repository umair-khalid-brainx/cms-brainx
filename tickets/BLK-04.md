# BLK-04: Per-block settings panel (Puck fields config)
- Milestone: M3 (week 3)
- Depends on: BLK-03
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.60 days, band C (see EXECUTION_PLAN.md "Bands")
## Goal
Each block has a settings panel to edit its props.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [x] Fields defined for all 14 blocks
- [ ] Draft: changing each field updates the canvas immediately and persists after save
- [ ] Draft: verified by a person in a real browser
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`admin/src/puck/config.tsx`. Puck mounts each field twice (root `CLAUDE.md` gotcha).
## History
fields defined for all 14 blocks, not interactively tested (drag/click unverifiable headlessly)
