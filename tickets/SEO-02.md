# SEO-02: Per-tenant sitemap.xml and robots.txt
- Milestone: M4 (week 4)
- Depends on: SEO-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Each tenant serves its own sitemap.xml and robots.txt.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [x] `<host>/sitemap.xml` lists only that site's published pages, entries and type listings, with last-modified dates
- [x] Drafts, archived, noindex pages and category/tag archives never appear; nor a page whose canonical address is another one (D-057)
- [x] `<host>/robots.txt` allows crawling and points at that host's sitemap
- [x] The proxy lets exactly these two files through to the tenant; both are built on every request, so the sitemap is never behind a publish, unpublish, move or noindex change (a route file's cache can't be cleared by path, D-057)
- [x] Two hosts never share entries; the XML is valid
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Note `web/src/proxy.ts`'s matcher skips paths with a file extension; `.xml`/`.txt` need handling.
## History
2026-10-12: done (D-057). `GET /public/sites/:subdomain/sitemap` (`api/src/public/sitemap-view.ts`), `app/sites/[subdomain]/sitemap.xml/route.ts` and `robots.txt/route.ts` in `web`, the proxy matcher gaining exactly those two paths. Built on every request, because a path refresh doesn't clear a route file's cached answer (tested in dev and in a production build). Each route checks the host against its tenant (review found `/sites/<x>/sitemap.xml` answering on any host). Verified with curl on two hosts (lists, exclusions, valid XML, 404s, headers, freshness after publish, noindex, rename, unpublish and archive); verifier passed; review asked for the host check, a sitemap limit that keeps the listings, and a Cache-Control header, all done. `web` gained `npm test` (14 → 17 tests).
