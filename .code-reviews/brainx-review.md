---
diff_hash: f812bde22a2f053b9ad50244ae808a639473d4ddae3ef338fd4c94667c58f050
reviewed_at: 2026-10-12T10:40:51Z
---

## Summary

SEO-02 (D-057): per-tenant `sitemap.xml` and `robots.txt`. `api` gains `ContentRepository.findSitemapRows(siteId)`
(published rows only, ordered by path, `take` 50,001), `GET /public/sites/:subdomain/sitemap`, and a pure
`buildSitemap` (drops noindex rows, adds one listing per type with an indexable entry, caps at 50,000 keeping the
listings). `web` gains two `force-dynamic` route handlers under `app/sites/[subdomain]/`, each checking the request's
`Host` against its tenant (`isOwnHost`) because extension paths skip the proxy; the proxy matcher gains exactly
`/sitemap.xml` and `/robots.txt`; `getSitemap` reads the API with `no-store`; XML is escaped. `web` gets `npm test`
(Node's runner) with `allowImportingTsExtensions`. The previous commit's review file is removed (staged deletion).

Stacks: `api/` NestJS (nestjs.md), `web/` Next.js (react.md). One git repository, so one review. Cross-project
contract check: `api`'s `SitemapEntry` (`{ path, lastModified }`) matches `web/src/lib/publicApi.ts`'s field for field.
Entry paths are `/<prefix>/<slug>` (`content.service.ts:105`), so the listing derivation `/${path.split('/')[1]}` matches
the existing revalidation code (`content.service.ts:246`); top-level page slugs can't take a type prefix, so a listing
can't duplicate a page. Tenant scoping holds: the repository method takes `siteId`; the routes refuse foreign hosts.

Verified: `web` `npm test` 17/17 pass, `web` `tsc --noEmit` clean, `api` `vitest run src/public` 59/59 pass.

## Findings

### Critical (0)

### High (0)

### Medium (1)
- **api/src/public/sitemap-view.ts:16** — A page whose staff-entered canonical URL (SEO-01) points to a different address is still listed in the sitemap. *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Search engines treat a sitemap as a list of canonical URLs; listing an address whose own `<link rel="canonical">` (set by `pageMetadata` from `seo.canonicalUrl`) points elsewhere sends conflicting signals, and Google reports such URLs as "Alternate page with proper canonical tag" / ignores the sitemap hint. Only `noindex` is filtered today. Fix: leave out rows whose `readSeo(row.seo).canonicalUrl` is set and isn't this page's own address. Because `api` doesn't know the public origin, either pass `canonicalUrl` through in `SitemapEntry` and filter in `web` (`sitemapXml` has the origin), or treat any set canonical as "not this address" and accept the rare self-canonical being dropped. Note the decision in D-057 either way.

### Low (2)
- **api/src/content/content.repository.ts:6** — The 50,000 limit is defined twice: `SITEMAP_ROWS` here and `SITEMAP_LIMIT` in `api/src/public/sitemap-view.ts:9`, same value and same doc comment. *(maintainability)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Two independently editable constants for one rule; changing one (e.g. lowering the cap) silently desynchronises the read cap from the output cap. Export one and import it in the other (the view module is pure, so the repository importing from it, or both from a small shared module, is fine).
- **api/src/public/public.service.ts:97** — The "sitemap stops at the limit" warning only fires when more than 50,000 rows come back, but `buildSitemap` also drops pages whenever indexable rows plus listings exceed 50,000 (e.g. 49,999 rows and 3 type listings), with no log. *(maintainability)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Edge case at real scale only, but it means the logged warning doesn't reliably say when addresses were left out. Either have `buildSitemap` report whether it truncated (e.g. return `{ entries, truncated }`) and log on that, or word the warning as "more than N live rows" so it doesn't claim to cover every truncation.

## Reviewed files
- .code-reviews/brainx-review.md (deletion of previous commit's review; not reviewed)
- api/src/content/content.repository.ts
- api/src/public/public.controller.ts
- api/src/public/public.service.spec.ts
- api/src/public/public.service.ts
- api/src/public/sitemap-view.spec.ts
- api/src/public/sitemap-view.ts
- docs/BACKLOG.md (skimmed)
- docs/DECISIONS.md
- docs/WORKLOG.md (skimmed)
- tickets/SEO-02.md
- tickets/STATUS.md (skimmed)
- web/package.json
- web/src/app/sites/[subdomain]/robots.txt/route.ts
- web/src/app/sites/[subdomain]/sitemap.xml/route.ts
- web/src/lib/publicApi.ts
- web/src/lib/seo.test.ts
- web/src/lib/sitemap.test.ts
- web/src/lib/sitemap.ts
- web/src/lib/tenant.test.ts
- web/src/lib/tenant.ts
- web/src/proxy.ts
- web/tsconfig.json
