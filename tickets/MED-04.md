# MED-04: Media documents, alt text, title and description
- Milestone: M3 (week 3)
- Depends on: MED-02
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band B (see EXECUTION_PLAN.md "Bands")
- Requirement: req. 4 (upload images and documents; alternative text, titles and descriptions; file type, size and upload date)
## Goal
The media library takes documents as well as images, and every file can carry alternative text, a title and a description.
## Definition of Done
_Confirmed with the user 2026-10-09 (alt text reaches pages as an automatic fallback on the live site)._
- [x] PDF, Word (.docx) and Excel (.xlsx) files upload to the library; the bytes must match the claimed type (`%PDF-` / zip header), anything else is refused
- [x] Documents show as a file-type tile in the library grid (no thumbnail) and open from the detail panel
- [x] The library detail panel edits alternative text (images only), title and description, and saves them per site
- [x] The detail panel shows file type, size and upload date
- [x] An image on a page with no alt text of its own uses the library's alt text on the live site; text typed on the page wins. The stored page data is unchanged
- [x] Changing a file's alt text refreshes the live pages that use it
- [x] Only the caller's own site's files can be read or changed
- [x] Documents can't be picked into image fields (the image picker and the editor's upload stay images only)
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`api/src/media/`, `admin/src/pages/MediaPage.tsx`, `api/src/public/public.service.ts` (the fallback, one scoped query per page view). Title and description are library information only; they are not shown on the live site. Picking a document into a field is `TYP-02`'s media field.
## History
2026-10-09: done (D-047). PDF/Word/Excel uploads with a first-bytes check and `nosniff`; `alt`, `title`, `description` per file; the live site falls back to the library's alt text; a Details form and file tiles in the library, light and dark. Checked in a real browser (tiles, typing and saving details, the discard prompt) and on the live site (fallback, typed text wins, stored page unchanged). The verifier passed every item, including cross-tenant access and a refresh of the live pages on an alt change. The review found nothing serious; fixed: parallel refresh, NUL characters in text, unsaved-changes prompt, a stale form after replace, title edge cases, small admin nits. Left: B-25.
