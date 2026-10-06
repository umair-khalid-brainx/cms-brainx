# FND-04: Host to site resolution with cache
- Milestone: M1 (week 1)
- Depends on: FND-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Resolve a request's host to its site quickly, with an in-memory cache.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [x] `corrick.lvh.me` resolves to the Corrick site via `subdomain` (built in `CNT-07`)
- [ ] Draft: subdomain → site lookups are cached in memory in `api` (or `web`), not one DB query per request
- [ ] Draft: the cache entry is invalidated when a site's subdomain changes, so a rename takes effect immediately
- [ ] Draft: an unknown subdomain is not cached as a permanent miss
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`api/src/sites/site.repository.ts` (`findBySubdomain`), `api/src/sites/sites.service.ts` (`updateSubdomain` must invalidate), `web/src/proxy.ts`. D-030, D-031.
## History
resolution built with `CNT-07` (host → subdomain in `web/src/proxy.ts`, subdomain → site via `SiteRepository.findBySubdomain`); the in-memory cache is not, so every request does one site lookup
