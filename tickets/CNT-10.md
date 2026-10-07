# CNT-10: Duplicate page
- Milestone: M2 (week 2)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.15 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Duplicate an existing page as a new draft.
## Definition of Done
_Confirmed with the user 2026-10-07._
- [ ] `POST /content/:slug/duplicate` (needs `content:write`) creates a copy with the same blocks, as a `draft`, never archived
- [ ] Slug is `<slug>-copy`, then `<slug>-copy-2`, `-copy-3` … if taken; title gets ` (copy)`
- [ ] The copy sits under the same parent as the original (same path prefix; top-level today, since hierarchy is `CNT-05`)
- [ ] Duplicating never crosses sites: an unknown slug or another site's slug → 404
- [ ] Pages list (active tab) has a Duplicate row action; the copy appears in the list without a reload
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`ContentService.duplicate`, `ContentController`, `admin/src/lib/contentApi.ts`, `PagesListPage.tsx`.
UI built with the `frontend-design` / `ui-ux-pro-max` skills, matching the existing admin look.
