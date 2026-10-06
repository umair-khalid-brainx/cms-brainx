# SEO-02: Per-tenant sitemap.xml and robots.txt
- Milestone: M4 (week 4)
- Depends on: CNT-07
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Each tenant serves its own sitemap.xml and robots.txt.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: `<subdomain>/sitemap.xml` lists only that site's published pages
- [ ] Draft: `<subdomain>/robots.txt` points at that sitemap
- [ ] Draft: drafts and archived pages never appear
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Note `web/src/proxy.ts`'s matcher skips paths with a file extension; `.xml`/`.txt` need handling.
