# BLK-03: Editor canvas (Puck): add, delete, reorder, duplicate
- Milestone: M2 (week 2)
- Depends on: XRP-01, CNT-02
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 1.00 days, band C (see EXECUTION_PLAN.md "Bands")
## Goal
Editors can add, delete, reorder and duplicate blocks on the Puck canvas.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [x] Canvas lists all 14 blocks and saves to a real page
- [ ] Draft: add a block from the sidebar and it appears on the canvas and persists after save
- [ ] Draft: delete, reorder (drag) and duplicate each work and persist
- [ ] Draft: verified by a person in a real browser (not headless)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`admin/src/pages/EditorPage.tsx`, `admin/src/puck/config.tsx`. D-013.
## History
canvas built with all 14 real blocks, now wired to a real content record via `CNT-02`; add/delete/reorder/duplicate themselves still not interactively tested (drag/click unverifiable headlessly)
