# MED-02: Library grid, reuse, replace, delete, metadata
- Milestone: M3 (week 3)
- Depends on: MED-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.25 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
A media library to browse, reuse, replace and delete files.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [x] `/media` grid with a detail panel, metadata, Copy URL and Delete
- [x] Reuse via the picker (`MED-03`)
- [ ] Draft: replace a file in place, keeping its URL
- [ ] Draft: warn before deleting a file still used on a page (`BACKLOG.md` B-12)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`admin/src/pages/MediaPage.tsx`, `api/src/media/`. D-026.
## History
`/media` page: grid of a site's uploads (backed by a real `Media` table, D-026), detail panel with metadata + Copy URL, Delete. Reuse now covered by `MED-03`'s picker; still no "replace in place" (delete + re-upload is the only path to swap a file)
