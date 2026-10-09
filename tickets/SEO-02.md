# SEO-02: Per-tenant sitemap.xml and robots.txt
- Milestone: M4 (week 4)
- Depends on: SEO-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Each tenant serves its own sitemap.xml and robots.txt.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [ ] `<host>/sitemap.xml` lists only that site's published pages, entries and type listings, with last-modified dates
- [ ] Drafts, archived, noindex pages and category/tag archives never appear
- [ ] `<host>/robots.txt` allows crawling and points at that host's sitemap
- [ ] The proxy lets exactly these two files through to the tenant; both refresh on publish, unpublish and SEO changes
- [ ] Two hosts never share entries; the XML is valid
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Note `web/src/proxy.ts`'s matcher skips paths with a file extension; `.xml`/`.txt` need handling.
