# CNT-09: Signed-token preview URLs
- Milestone: M2 (week 2)
- Depends on: CNT-07
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Editors can share a signed link that previews a draft page on the real site.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: admin can generate a preview URL for a draft page
- [ ] Draft: the URL carries a signed, expiring token; without it the draft stays a 404
- [ ] Draft: a token for site A can't preview a page on site B
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
New API endpoint that issues tokens; `web` route or proxy branch that accepts them. Must not loosen `findLiveByPath`.
