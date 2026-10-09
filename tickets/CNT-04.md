# CNT-04: Slug handling and per-site uniqueness
- Milestone: M1 (week 1), built in week 4 (D-052)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.15 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Slugs are valid, unique within a site, and stable when a title changes.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [ ] Slugs are lowercase, URL-safe and normalised server-side, whatever the client sends
- [ ] Slugs are unique across one site (admin routes by slug alone); the same slug in two sites is allowed
- [ ] Editing a page's title never changes its slug
- [ ] Changing a slug is an explicit action in the editor's Page settings panel, with the full new address shown and a warning on a live page; the editor then moves to the new `/editor/<slug>`
- [ ] A slug that clashes with `home`, a reserved prefix or a type's prefix is refused with a clear message
- [ ] The Page settings panel is designed once here with room for parent, SEO and categories/tags sections, works with the keyboard, on tablet, light and dark
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`api/src/content/content.service.ts` (`uniqueSlug`). Slug changes later trigger redirects (`GOV-05`).
