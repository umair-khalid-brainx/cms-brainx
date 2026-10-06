# FND-04: Host to site resolution with cache
- Milestone: M1 (week 1)
- Depends on: FND-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Resolve a request's host to its site quickly, with an in-memory cache.
## Definition of Done
- [x] `corrick.lvh.me` resolves to the Corrick site via `subdomain` (built in `CNT-07`)
- [x] subdomain → site id lookups are cached in memory in `api`, not one DB query per request (D-035)
- [x] the cache entry is invalidated when a site's subdomain changes, so a rename takes effect immediately
- [x] an unknown subdomain is not cached at all
- [x] Tests pass (`api/src/sites/subdomain-cache.spec.ts`). Built without `/build`: no reviewer or verifier agent run
## Technical notes
`api/src/sites/subdomain-cache.ts` (`SubdomainCache`), `api/src/sites/sites.service.ts` (`updateSubdomain` invalidates), `api/src/public/public.service.ts`. D-030, D-031, D-035.
## History
resolution built with `CNT-07` (host → subdomain in `web/src/proxy.ts`, subdomain → site via `SiteRepository.findBySubdomain`); the in-memory cache is not, so every request does one site lookup

2026-10-06: `SubdomainCache` built (D-035). The user confirmed the drafted DoD with three choices: cache in `api`, id only, misses not cached. Page views now cost no site query after the first; a rename switches old → 404, new → 200 at once. See `WORKLOG.md` 2026-10-06.
