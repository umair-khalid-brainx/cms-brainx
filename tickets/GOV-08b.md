# GOV-08b: Second tenant branding, content, cross-tenant bug hunt
- Milestone: M5 (week 5)
- Depends on: GOV-08a, GOV-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.80 days, band D (re-estimated in docs/WEEK5_PLAN.md, D-064)
## Goal
The second tenant is fully branded with real content, and a cross-tenant bug hunt is done.
## Definition of Done
_Confirmed with the user on 2026-10-12 (docs/WEEK5_PLAN.md)._
- [x] Kestrel has its own logo, tagline, footer note, header and footer menus and at least five pages, including nested ones and a contact form
- [x] A repeatable cross-tenant spec calls every admin route as one tenant's owner with the other tenant's slugs and ids and gets 404/403; every public route on both hosts shows only its own data; an ISR refresh on one host leaves the other's cache HIT
- [x] A check that nothing outside a repository imports `PrismaService` (FND-03, folded in)
- [x] Every leak found is fixed with its own test and listed in WORKLOG
- [x] All tests pass. Reviewer approved. Verifier passed.

## Technical notes
Depends on `GOV-08a`, `GOV-04`. Root invariant 6: test with two hosts.
