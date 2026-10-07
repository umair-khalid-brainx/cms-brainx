# CNT-08: ISR revalidation on publish, host-inclusive cache key
- Milestone: M2 (week 2)
- Depends on: CNT-07, GOV-08a
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.45 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Public pages are cached (ISR) per host and refreshed the moment they change.
## Definition of Done
_Confirmed with the user 2026-10-07. Tested on `lvh.me`; DEC-2 (real domain) not needed._
- [ ] Public pages are served from Next's cache instead of rendered on every request (verified on `next build && next start`, not dev)
- [ ] Publish, unpublish, archive and saving a published page refresh exactly that site + path, immediately
- [ ] If `web` can't be reached, the API change still succeeds (warning logged); every cached page also expires after 60 s as a backstop
- [ ] Theme, site-name and subdomain changes are left to the 60 s backstop (user's call)
- [ ] The cache key includes the tenant: tested with `corrick.lvh.me` and `kestrel.lvh.me` — a refresh of one never touches the other
- [ ] The revalidate endpoint rejects calls without the shared secret
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Builds on the `/sites/[subdomain]` rewrite (D-030). Replace `cache: 'no-store'` in
`web/src/lib/publicApi.ts`. `api` calls `web`'s revalidate route with a shared secret. Root invariant 6.
