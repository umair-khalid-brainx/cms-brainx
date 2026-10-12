# SEO-01: SEO fields, meta rendering, Open Graph
- Milestone: M4 (week 4)
- Depends on: CNT-07
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Pages have SEO fields that render as real meta tags and Open Graph.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [x] Each page and entry has meta title, meta description, canonical URL, social title, social description, social image and a "hide from search engines" switch, stored and validated on write
- [x] Page settings has an SEO section with a search-result preview, a social card preview and length counters; the social image uses the media picker
- [x] The public page source has `<title>`, meta description, canonical link, `og:*` and `twitter:card` tags, and `noindex` when switched on
- [x] Fallbacks when empty: title → "Page · Site"; description → excerpt; social text → meta text; social image → featured image (`GOV-04` adds the site logo as the last resort); canonical → the page's own URL
- [x] Type listings get proper meta too; public 404 pages say "Page not found · Site" (`BACKLOG.md` B-15)
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`generateMetadata` in `web/src/app/sites/[subdomain]/[[...path]]/page.tsx`. Page source is inspected in the pitch.
## History
2026-10-12: done (D-056). `Content.seo` (one validated object), `api/src/content/seo.ts` for the rules, `api/src/public/seo-view.ts` for the fallbacks, `web/src/lib/seo.ts` for the tags, and a "Search and sharing" section in Page settings with a search-result preview, a shared-link preview, length counters and the media picker. Verified on the real page source with curl on two hosts (title, description, canonical, Open Graph, Twitter card, noindex, every fallback, the listing, the 404 title) and in the browser (light/dark, desktop/tablet); verifier passed; review asked for a safe production default for the canonical origin, a try/catch on the 404 title, an accessible name for the image button and a sturdier Esc, all fixed. Also removed the platform's description from the root layout (it leaked onto tenant pages) and closed B-15.
