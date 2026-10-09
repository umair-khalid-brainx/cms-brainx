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
- [x] Rich text uses the same TipTap setup as `BLK-05`, with a floating menu on the canvas that has the same controls, link included (D-046)
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Puck's `contentEditable` on the field config (`admin/src/puck/config.tsx`), no `Editable` primitive (D-046). `admin/src/components/RichTextToolbar.tsx` holds the sidebar and canvas menus.
## History
2026-10-09: done (D-046). `contentEditable` on every top-level text field (two exceptions), `RichTextInlineMenu` for the canvas, tests for coverage and for rendering with editable nodes. Checked by hand in a real browser with real clicks and typing: Hero headline, testimonial quote, rich-text formatting and a link added from the floating menu. The review found that Puck ends the editing session when focus leaves a menu lacking `data-puck-rte-menu` (fixed; the link button is back on the canvas menu), that typed line breaks showed in the canvas but not on the public site (fixed), and that empty fields leave blank structure in the canvas (B-24, not fixed). The verifier passed all items, including a production-build check that the public HTML has no editor markup.
