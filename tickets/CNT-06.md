# CNT-06: Denormalised path and recursive recomputation
- Milestone: M1 (week 1)
- Depends on: CNT-05
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.35 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Each page's `path` is stored and recomputed for the whole subtree when a slug or parent changes.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: `path` = parent's path + `/` + slug; Home stays `/`
- [ ] Draft: changing a slug or parent recomputes `path` for every descendant in one transaction
- [ ] Draft: only that subtree changes; other pages and other sites are untouched
- [ ] Draft: an invariant test covers recursive recomputation (`api/CLAUDE.md` invariant 6)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Root `CLAUDE.md` invariant 9. Public lookup already matches on `path` (`findLiveByPath`).
