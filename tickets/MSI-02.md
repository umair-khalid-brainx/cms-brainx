# MSI-02: API: create a site
- Milestone: multi-site accounts (post week 5)
- Depends on: MSI-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: not estimated (added 2026-10-14)
## Goal
A person who owns a site can start another.
## Definition of Done
_Agreed with the user 2026-10-14 (only the title was given; details chosen with them in chat)._
- [x] `POST /sites` `{ name, subdomain }`: new empty site, default (Oyster) theme, caller its only owner, written in one operation
- [x] Only someone who owns at least one site (403 otherwise; user decision 2026-10-14, no admin-request flow, B-42)
- [x] Address rules as renaming (format, reserved names); taken: 409, also when two requests race; body cannot carry `siteId` or `role`
- [x] Tests: unit (`sites.service.spec.ts`) and e2e
- [x] Tests pass; independent review and verification done
## Technical notes
`SitesService.create`, `SiteRepository.createWithOwner`, `CreateSiteController`. D-070.
## History
2026-10-14: done. Reviewer found a request-chain-crosses-sites risk on switching (fixed by reloading on a site change) and
smaller items now in B-44. Verifier passed the API tickets; the admin ones have unit tests for the pure logic and were
checked in Chrome, with no automated component tests.
