# TYP-04: Template selection on create
- Milestone: M3 (week 3)
- Depends on: TYP-05
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Choose a starter template when creating a page.
## Definition of Done
_Confirmed with the user 2026-10-09 (the four seeded layouts plus Blank, no new layouts; a new Post starts from Article; D-051)._
- [x] The create screen (pages and entries of any type) offers Blank and the four starter layouts from `TYP-05` as cards, each with its description and the blocks it contains
- [x] A new page starts with a copy of the chosen layout's blocks; Blank starts empty; choosing is optional
- [x] A new Post is preselected to Article; every other create screen to Blank
- [x] The server copies the layout from the platform's table; a request can't send blocks and a layout together, and an unknown layout is a 404
- [x] Each page gets its own copy: editing one never changes the layout or another page; the copy goes through the usual sanitising
- [x] The picker works with the keyboard and a screen reader (radio group, labelled cards, a mark for the selected one), on light and dark
- [x] If the layouts can't be loaded the screen still creates a blank page
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`admin/src/pages/CreatePagePage.tsx`.
## History
2026-10-09: done (D-051). Blank plus the four seeded layouts as radio cards on every create screen; the server copies the layout; a new Post starts from Article. A verifier and review checked every item with curl (all four layouts, pages and entries, bad keys, independent copies, each layout publishing as-is, two tenants). Fixed: a Post asking for Article when the layouts hadn't loaded, the hidden radio inheriting form-input styles, a doubled group name for screen readers, no length limit on the layout key.
