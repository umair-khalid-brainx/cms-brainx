# TAX-02: Archive and category listing pages
- Milestone: M4 (week 4)
- Depends on: TAX-01, CNT-07
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Public listing pages for a category or tag.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [x] `/category/<slug>` and `/tag/<slug>` list published entries with that term, newest first, using the type listing's layout; an unknown term is a 404
- [x] Archive pages are `noindex`; `category` and `tag` are reserved prefixes
- [x] A public entry shows its categories and tags as links to their archives
- [x] Under a published entry: up to 3 newest published entries of the same type sharing a category, else a tag; absent when there are none
- [x] Publishing or retagging an entry refreshes its term archives; colours only via `--site-*` (invariant 2)
- [x] All tests pass.
- [ ] Reviewer approved. Verifier passed.
## Technical notes
Plan: archives ship noindex by default, as WordPress does.
