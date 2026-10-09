# SEO-01: SEO fields, meta rendering, Open Graph
- Milestone: M4 (week 4)
- Depends on: CNT-07
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Pages have SEO fields that render as real meta tags and Open Graph.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [ ] Each page and entry has meta title, meta description, canonical URL, social title, social description, social image and a "hide from search engines" switch, stored and validated on write
- [ ] Page settings has an SEO section with a search-result preview, a social card preview and length counters; the social image uses the media picker
- [ ] The public page source has `<title>`, meta description, canonical link, `og:*` and `twitter:card` tags, and `noindex` when switched on
- [ ] Fallbacks when empty: title → "Page · Site"; description → excerpt; social text → meta text; social image → featured image (`GOV-04` adds the site logo as the last resort); canonical → the page's own URL
- [ ] Type listings get proper meta too; public 404 pages say "Page not found · Site" (`BACKLOG.md` B-15)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`generateMetadata` in `web/src/app/sites/[subdomain]/[[...path]]/page.tsx`. Page source is inspected in the pitch.
