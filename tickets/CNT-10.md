# CNT-10: Duplicate page
- Milestone: M2 (week 2)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.15 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Duplicate an existing page as a new draft.
## Definition of Done
_Confirmed with the user 2026-10-07._
- [x] `POST /content/:slug/duplicate` (needs `content:write`) creates a copy with the same blocks, as a `draft`, never archived
- [x] Slug is `<slug>-copy`, then `<slug>-copy-2`, `-copy-3` … if taken; title gets ` (copy)`
- [x] The copy sits under the same parent as the original (same path prefix; top-level today, since hierarchy is `CNT-05`)
- [x] An archived page can't be duplicated (409) — that would restore it without `content:delete`
- [x] Duplicating never crosses sites: an unknown slug or another site's slug → 404
- [x] Pages list (active tab) has a Duplicate row action; the copy appears in the list without a reload
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`ContentService.duplicate`, `ContentController`, `admin/src/lib/contentApi.ts`, `PagesListPage.tsx`.
UI built with the `frontend-design` / `ui-ux-pro-max` skills, matching the existing admin look.
## History
2026-10-07: done. `ContentService.duplicate` + `POST /content/:slug/duplicate`; Duplicate row action
on the Pages list inserts the copy at the top with a one-off highlight and an "Open in editor" notice
(`aria-live`). Checked in the browser in dark and light mode as Kestrel's owner (`-copy`, `-copy-2`).
Reviewer approved; its should-fix (archived sources reachable via the API) applied. Verifier passed.
Known and accepted: two simultaneous duplicates can race to the same slug (500 from the unique
index), same as `create`.
