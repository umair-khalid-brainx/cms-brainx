# GOV-05: Redirect engine and auto-redirect on slug change
- Milestone: M4 (week 4)
- Depends on: CNT-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.40 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Redirects, including an automatic one when a slug changes.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: admin can create manual redirects (from path → to path) per site
- [ ] Draft: changing a page's slug creates a redirect from the old path
- [ ] Draft: redirects are 301 and never chain endlessly
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Depends on `CNT-04`. Subdomain renames deliberately don't redirect (D-031).
