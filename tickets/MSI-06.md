# MSI-06: Cross-site checks: isolation and docs
- Milestone: multi-site accounts (post week 5)
- Depends on: MSI-01, MSI-02
- Use cases: none yet (no docs/use-cases.md)
- Estimate: not estimated (added 2026-10-14)
## Goal
Prove one person in two sites cannot cross them, and write it down.
## Definition of Done
_Agreed with the user 2026-10-14 (only the title was given; details chosen with them in chat)._
- [x] e2e: forged and unknown site ids give 403 on every kind of route; a page of one site is not readable under another's header; a write lands only in the named site
- [x] Cross-tenant route table updated (`PATCH /sites/:siteId/theme` row added; `POST /sites` listed as not tied to a site)
- [x] D-070, CLAUDE.md gotchas, B-42, B-43, B-44
- [x] Tests pass; independent review and verification done
## Technical notes
Follow-ups from review are in B-44.
## History
2026-10-14: done. Reviewer found a request-chain-crosses-sites risk on switching (fixed by reloading on a site change) and
smaller items now in B-44. Verifier passed the API tickets; the admin ones have unit tests for the pure logic and were
checked in Chrome, with no automated component tests.
