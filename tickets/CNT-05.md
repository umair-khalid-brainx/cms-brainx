# CNT-05: Page hierarchy: parent, depth limit, cycle guard
- Milestone: M1 (week 1), built in week 4 (D-052)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.25 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Pages can have a parent page, with a depth limit and no cycles.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [ ] `Content.parentId` is optional and points at a page in the same site; a parent from another site is refused
- [ ] Only pages nest; an entry of a type can't have or be a parent (400)
- [ ] A page can't be its own ancestor (cycle guard, 400), checked through any number of levels
- [ ] Nesting is limited to 3 levels; deeper is refused. Home can't have a parent or children
- [ ] A page with children can't be permanently deleted (409); a parent's status doesn't hide its children
- [ ] Page settings has a parent picker (searchable, indented by depth, invalid choices disabled with the reason); the Pages list shows the hierarchy
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Schema migration on `content`; `ContentRepository`, `ContentService`. Depth limit: 3 levels (D-052).
