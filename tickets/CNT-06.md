# CNT-06: Denormalised path and recursive recomputation
- Milestone: M1 (week 1), built in week 4 (D-052)
- Depends on: CNT-05
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Each page's `path` is stored and recomputed for the whole subtree when a slug or parent changes.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [x] `path` = parent's path + `/` + slug; Home stays `/`
- [x] Changing a slug or parent recomputes `path` for the page and every descendant in one transaction
- [x] Only that subtree changes; other pages and other sites are untouched
- [x] If any new path would collide, nothing is written (409)
- [x] Old and new paths of every live page in the subtree are revalidated after the commit
- [x] The service returns the list of path moves, which `GOV-05` uses
- [x] Nested paths render on the public site, checked on two hosts (closes `CNT-07`'s note)
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Root `CLAUDE.md` invariant 9. Public lookup already matches on `path` (`findLiveByPath`).
## History
2026-10-12: done with `CNT-05` (D-054). Paths are rebuilt from parent links for the whole subtree and written in one transaction under a per-site advisory lock (`ContentRepository.updateInTree`); a clash refuses the whole move (409); every live moved page is revalidated at its old and new address; `PATCH` answers with `moved: [{ from, to }]` for `GOV-05`. Invariant tests in `page-tree.spec.ts`. Verified: subtree rename and re-parent on two hosts (only the subtree changes, the other site untouched), collision with nothing written, two crossing moves fired at once (one wins, no loop), nested paths 200 on their own host and 404 on the other.
