# GOV-08a: Minimal second tenant and host mapping
- Milestone: M2 (week 2)
- Depends on: FND-04, FND-06
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.15 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
A second tenant with its own subdomain, so isolation can be tested with two real hosts.
## Definition of Done
_Confirmed with the user 2026-10-07._
- [ ] `npm run db:seed` creates Kestrel Rigging (`kestrel` subdomain, `kestrel.yourcms.com` host) with its dark technical theme from the old fixture (`f161fd8`)
- [ ] Kestrel gets its own owner user (separate login, member of Kestrel only); the existing Corrick owner is unchanged
- [ ] Kestrel is seeded with Home (published) + Capability (published) + Method statements (draft)
- [ ] Seed is re-runnable: a second run creates no duplicates
- [ ] `kestrel.lvh.me` and `corrick.lvh.me` each render only their own pages and theme; Kestrel's draft is a 404
- [ ] As Kestrel's owner, `GET /content` lists only Kestrel pages and `GET /content/home`/`PATCH` touch only Kestrel's Home (and the reverse for Corrick)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`api/prisma/seed.ts`. Copy recovered from `web/src/fixtures/kestrel.ts` at `f161fd8`; the fixture's
`/media/*.svg` images no longer exist, so seeded blocks don't reference images. Owner login lives in
the seed file (dev-only credentials, same convention as Corrick's).
