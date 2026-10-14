# ADM-05: Admin: read-only side view of a page or post
- Milestone: admin redesign (post multi-site)
- Depends on: ADM-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: not estimated (added 2026-10-14)
## Goal
Click a row to see a page or post's details in a side panel without opening the editor.
## Definition of Done
_Agreed with the user 2026-10-14 (only the title was given; look and menu grouping chosen with them in chat)._
- [x] Selecting a row (or the row menu's "Details") opens a right-hand panel with title, path, status, schedule, dates, SEO summary, categories/tags where the type has them
- [x] Read-only: actions are links to Edit and View live (Preview not included: needs a token the list does not carry)
- [x] Escape and the close button dismiss it; focus returns to the row; shareable via `?view=<slug>`
- [x] Full screen sheet on mobile
- [x] Uses only data already returned by the list/get endpoints (no new API)
- [x] Typecheck, lint and tests pass
- [x] Independent review and verification done
## Technical notes
New `components/ContentSidePanel.tsx`.
## History
- 2026-10-14: `components/ContentSidePanel.tsx` added: read-only side view from row title or Details, `?view=<slug>`, Escape/close, focus returns to the row, full-screen sheet below 720px; `lib/seoSummary.ts` + tests. Verified in browser. Independent review and verification still to do.
