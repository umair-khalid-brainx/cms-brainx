# MSI-03: Admin: the site in the URL, and an active site
- Milestone: multi-site accounts (post week 5)
- Depends on: MSI-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: not estimated (added 2026-10-14)
## Goal
Every admin screen knows which site it is in, from its address.
## Definition of Done
_Agreed with the user 2026-10-14 (only the title was given; details chosen with them in chat)._
- [x] In-site screens live under `/sites/:siteId/...`; deep links and refresh keep the site
- [x] `X-Site-Id` is sent on every authenticated API call
- [x] A site the person is not in goes to All sites; old site-less URLs redirect into the last-used (else first) site
- [x] Changing site reloads the app, so no request from the old site can reach the new one (review finding)
- [x] Role-based UI (nav, buttons) follows the role in the active site
- [x] Tests: `lib/sitePath.test.ts`, `lib/activeSite.test.ts`; checked in Chrome
- [x] Tests pass; independent review and verification done
## Technical notes
`lib/activeSite.ts`, `lib/SiteScope.tsx`, `lib/siteRouter.tsx`, `lib/sitePath.ts`. In-site links stay `/pages`; import `Link`/`Navigate`/`useNavigate` from `lib/siteRouter`.
## History
2026-10-14: done. Reviewer found a request-chain-crosses-sites risk on switching (fixed by reloading on a site change) and
smaller items now in B-44. Verifier passed the API tickets; the admin ones have unit tests for the pure logic and were
checked in Chrome, with no automated component tests.
