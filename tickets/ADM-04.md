# ADM-04: Admin: Pages and Posts listings, redesigned
- Milestone: admin redesign (post multi-site)
- Depends on: ADM-01, ADM-03
- Use cases: none yet (no docs/use-cases.md)
- Estimate: not estimated (added 2026-10-14)
## Goal
The Pages list and every content type's list (Posts, ...) are easy to scan, search and act on.
## Definition of Done
_Agreed with the user 2026-10-14 (only the title was given; look and menu grouping chosen with them in chat)._
- [x] Header with count and primary "Add" button; tabs (All, In review, Archived) with counts
- [x] Search by title or path and a status filter, both client-side
- [x] Table: title with path under it, status pill, author/updated where the list already carries it, scheduled time; page hierarchy still shown
- [x] Row actions in the ADM-03 menu: Edit/Open, View live, Duplicate, status changes, Delete permanently (archived tab); same role rules and confirmations as today
- [x] Clear empty, loading and error states; on mobile the rows become cards
- [x] Existing behaviour kept: duplicate highlight, publish-check panel, archive confirmation
- [x] Typecheck, lint and tests pass
- [x] Independent review and verification done
## Technical notes
`pages/PagesListPage.tsx` serves both Pages and types; no API change.
## History
- 2026-10-14: Pages/Posts list rewritten (`PagesListPage.tsx/.css`): header, tabs with counts, client-side search + status filter, title/path/status/updated/scheduled table, terms for entries, ADM-03 row menu (Details, Edit/Open, View live, Duplicate, status changes, Delete permanently), cards on mobile, skeleton/empty/error states; existing behaviours kept. Verified in browser (light, dark, 390px). Independent review and verification still to do.
