# CNT-11: Trash, restore, permanent delete
- Milestone: M2 (week 2)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.25 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Pages can be archived, restored, and only then permanently deleted.
## Definition of Done
- [x] `archived` is a third page status (D-032)
- [x] Pages list status dropdown; archive asks to confirm
- [x] Archived tab restores to Draft or Published; Delete Permanently is separate
- [x] `DELETE /content/:slug` returns 409 unless the page is archived
- [x] Built and verified manually before this ticket file existed (see WORKLOG.md); no kit tests yet
## Technical notes
`api/src/content/`, `admin/src/pages/PagesListPage.tsx`. D-029 (superseded), D-032.
## History
`archived` is a third `ContentStatus` (D-032, supersedes D-029's `archivedAt`-as-flag). Every Pages-list row has a status dropdown listing the statuses the page isn't in (archive asks to confirm); the Archived tab's dropdown restores to Draft/Published, and Delete Permanently stays a separate button there. `DELETE /content/:slug` still refuses (409) unless archived. See `WORKLOG.md` 2026-10-06
