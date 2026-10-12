# CNT-05: Page hierarchy: parent, depth limit, cycle guard
- Milestone: M1 (week 1), built in week 4 (D-052)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.25 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Pages can have a parent page, with a depth limit and no cycles.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052); picker wording changed with the user's approval 2026-10-12 ("under Team" instead of an indent, so typing a title finds it; D-054)._
- [x] `Content.parentId` is optional and points at a page in the same site; a parent from another site is refused
- [x] Only pages nest; an entry of a type can't have or be a parent (400)
- [x] A page can't be its own ancestor (cycle guard, 400), checked through any number of levels
- [x] Nesting is limited to 3 levels; deeper is refused. Home can't have a parent or children
- [x] A page with children can't be permanently deleted (409); a parent's status doesn't hide its children
- [x] Page settings has a parent picker (searchable, in tree order with each option saying which page it sits under, invalid choices disabled with the reason); the Pages list shows the hierarchy
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Schema migration on `content`; `ContentRepository`, `ContentService`. Depth limit: 3 levels (D-052).
## History
2026-10-12: done with `CNT-06` (D-054). `Content.parentId` (Restrict), `api/src/content/page-tree.ts` for the rules (3 levels, no loops, pages only, not under home), create/move/duplicate under a parent, delete refused while children exist. Admin: Parent page picker in Page settings (search box, title-first options, archived pages included), Pages list indents children. Verified with curl on two tenants and in the browser; review asked for the move list, a per-site lock and a searchable picker, all fixed, then approved; verifier passed.
