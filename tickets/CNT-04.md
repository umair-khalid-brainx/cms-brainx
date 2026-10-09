# CNT-04: Slug handling and per-site uniqueness
- Milestone: M1 (week 1), built in week 4 (D-052)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.15 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Slugs are valid, unique within a site, and stable when a title changes.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052; live moves need publish, D-053)._
- [x] Slugs are lowercase, URL-safe and normalised server-side, whatever the client sends
- [x] Slugs are unique across one site (admin routes by slug alone); the same slug in two sites is allowed
- [x] Editing a page's title never changes its slug
- [x] Changing a slug is an explicit action in the editor's Page settings panel, with the full new address shown and a warning on a live page; the editor then moves to the new `/editor/<slug>`
- [x] A slug that clashes with `home`, a reserved prefix or a type's prefix is refused with a clear message
- [x] The Page settings panel is designed once here with room for parent, SEO and categories/tags sections, works with the keyboard, on tablet, light and dark
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`api/src/content/content.service.ts` (`uniqueSlug`). Slug changes later trigger redirects (`GOV-05`).
## History
2026-10-09: done (D-053). Slug changes through `PATCH /content/:slug`, normalised by `api/src/content/slug.ts`; refuses the home page, reserved words and type prefixes (pages only) and taken slugs; a per-site unique slug index catches races (409). Moving a live page needs `content:publish`. Editor: a Page settings panel (native `<dialog>`) with Title and Address; the editor follows the page to its new URL without reloading, saving unsaved edits first. Verified with curl on two tenants and by hand in the browser (keyboard, tablet light, desktop dark); verifier passed; review requested 3 fixes plus 5 smaller ones, all fixed, then approved. Also fixed: the editor's top bar wrapping at tablet width; titles couldn't be edited after creation.
