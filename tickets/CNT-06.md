# CNT-06: Denormalised path and recursive recomputation
- Milestone: M1 (week 1), built in week 4 (D-052)
- Depends on: CNT-05
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Each page's `path` is stored and recomputed for the whole subtree when a slug or parent changes.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [ ] `path` = parent's path + `/` + slug; Home stays `/`
- [ ] Changing a slug or parent recomputes `path` for the page and every descendant in one transaction
- [ ] Only that subtree changes; other pages and other sites are untouched
- [ ] If any new path would collide, nothing is written (409)
- [ ] Old and new paths of every live page in the subtree are revalidated after the commit
- [ ] The service returns the list of path moves, which `GOV-05` uses
- [ ] Nested paths render on the public site, checked on two hosts (closes `CNT-07`'s note)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Root `CLAUDE.md` invariant 9. Public lookup already matches on `path` (`findLiveByPath`).
