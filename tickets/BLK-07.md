# BLK-07: Inline editing: Editable primitive + TipTap in canvas
- Milestone: M3 (week 3)
- Depends on: XRP-01, BLK-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band C (see EXECUTION_PLAN.md "Bands")
## Goal
Edit text directly on the canvas instead of only in the sidebar.
## Definition of Done
_Confirmed with the user 2026-10-09 (D-045, D-046)._
- [x] Clicking a text element on the canvas makes it editable in place (every top-level text field except the two listed in D-046)
- [x] The edit saves to the same prop the sidebar edits
- [x] Rich text uses the same TipTap setup as `BLK-05`, with a matching floating menu on the canvas (no link button there, see D-046)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Puck's `contentEditable` on the field config (`admin/src/puck/config.tsx`), no `Editable` primitive (D-046). `admin/src/components/RichTextToolbar.tsx` holds the sidebar and canvas menus.
