# CNT-08: ISR revalidation on publish, host-inclusive cache key
- Milestone: M2 (week 2)
- Depends on: CNT-07, GOV-08a
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.45 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Public pages are cached (ISR) per host and refreshed the moment they change.
## Definition of Done
_Confirmed with the user 2026-10-07. Tested on `lvh.me`; DEC-2 (real domain) not needed._
- [x] Public pages are served from Next's cache instead of rendered on every request (verified on `next build && next start`, not dev)
- [x] Publish, unpublish, archive and saving a published page refresh exactly that site + path, immediately
- [x] If `web` can't be reached, the API change still succeeds (warning logged); every cached page also expires after 60 s as a backstop
- [x] Theme, site-name and subdomain changes are left to the 60 s backstop (user's call)
- [x] The cache key includes the tenant: tested with `corrick.lvh.me` and `kestrel.lvh.me` — a refresh of one never touches the other
- [x] The revalidate endpoint rejects calls without the shared secret
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Builds on the `/sites/[subdomain]` rewrite (D-030). Replace `cache: 'no-store'` in
`web/src/lib/publicApi.ts`. `api` calls `web`'s revalidate route with a shared secret. Root invariant 6.
## History
2026-10-07: done (D-039). ISR on `/sites/[subdomain]/[[...path]]` (`revalidate = 60`, empty
`generateStaticParams`), API fetches cached 60 s; `api` `RevalidationService` → `web` `/__revalidate`
(shared secret) → `revalidatePath('/sites/<sub><path>')` on publish, unpublish, archive and live
saves. Verified on a production build (`next start`): MISS→HIT; a direct DB edit stays hidden, an API
save shows on the next request; publish/unpublish/archive immediate; Corrick and Kestrel with the same
path keep separate entries and one's refresh leaves the other HIT; web down → publish still 200 in
16 ms with a warning, page caught up by the 60 s timer. Reviewer approved; verifier passed. Open:
cache can be filled with 404s by anyone (`B-17`); block `/__revalidate` in nginx (`B-18`). Theme and
subdomain changes wait for the timer (user's call).
