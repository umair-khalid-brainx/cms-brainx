# MSI-01: API: the active site comes from an X-Site-Id header
- Milestone: multi-site accounts (post week 5)
- Depends on: none
- Use cases: none yet (no docs/use-cases.md)
- Estimate: not estimated (added 2026-10-14)
## Goal
The API acts on the site the admin names, not on the caller's first membership.
## Definition of Done
_Agreed with the user 2026-10-14 (only the title was given; details chosen with them in chat)._
- [x] Every route that resolved the site from `memberships[0]` (content, workflow, revisions, redirects, terms, menus, media, content types, submissions) and `PermissionsGuard` use `UserRepository.findActiveMembership`
- [x] Header missing or blank: the caller's oldest membership (`ORDER BY created_at`). Header naming a site the caller is not in, or no site at all: 403
- [x] The role checked is the caller's role in the named site
- [x] Routes with `:siteId` in the path ignore the header and keep their own membership check
- [x] Tests: unit (`users/active-membership.spec.ts`) and e2e (`test/multi-site.e2e-spec.ts`) with one person in two sites
- [x] Tests pass; independent review and verification done
## Technical notes
Middleware + `AsyncLocalStorage` in `api/src/common/active-site.ts`. D-070.
## History
2026-10-14: done. Reviewer found a request-chain-crosses-sites risk on switching (fixed by reloading on a site change) and
smaller items now in B-44. Verifier passed the API tickets; the admin ones have unit tests for the pure logic and were
checked in Chrome, with no automated component tests.
