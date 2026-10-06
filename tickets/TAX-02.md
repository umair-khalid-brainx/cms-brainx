# TAX-02: Archive and category listing pages
- Milestone: M4 (week 4)
- Depends on: TAX-01, CNT-07
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Public listing pages for a category or tag.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: `/category/<slug>` and `/tag/<slug>` list published entries with that term
- [ ] Draft: listing pages are `noindex` by default
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Plan: archives ship noindex by default, as WordPress does.
