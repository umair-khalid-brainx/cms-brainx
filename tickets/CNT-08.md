# CNT-08: ISR revalidation on publish, host-inclusive cache key
- Milestone: M2 (week 2)
- Depends on: CNT-07, GOV-08a
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.45 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Public pages are cached (ISR) per host and refreshed the moment a page is published.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: public pages are statically cached instead of rendered on every request
- [ ] Draft: publishing, unpublishing or archiving a page revalidates exactly that site + path
- [ ] Draft: a subdomain rename revalidates that site's pages
- [ ] Draft: the cache key includes the tenant; tested with two real tenants (needs `GOV-08a`)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Builds on the `/sites/[subdomain]` rewrite (D-030). Replace `cache: 'no-store'` in `web/src/lib/publicApi.ts`. Root invariant 6.
