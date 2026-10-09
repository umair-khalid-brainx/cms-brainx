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
- [x] Changing a field updates the canvas immediately and persists after save — every field kind checked in the browser on 2026-10-06 (text, textarea, radio, yes/no radio, link object, image URL, list, list inside a list), stored shape matches `cms-blocks/types.ts`
- [ ] Verified by a person (the user) in a real browser
- [ ] All tests pass. Reviewer approved. Verifier passed.
- [x] Every field, block and list item has a human label (no raw prop keys like `primaryAction`, no "Item 1")
## Technical notes
`admin/src/puck/config.tsx`. Puck mounts each field twice (root `CLAUDE.md` gotcha).
## History
fields defined for all 14 blocks, not interactively tested (drag/click unverifiable headlessly)
2026-10-06: added labels to every field and block, and `getItemSummary` to every list. Checked in the in-app browser on a draft page `blk04-settings-test` seeded with all 14 blocks. Drag-from-drawer doesn't register with synthetic pointer events (BLK-03's problem, not this ticket's). Canvas still uses hard-coded `corrickTheme` (B-16).
