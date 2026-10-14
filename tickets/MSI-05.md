# MSI-05: Admin: split Settings into site settings and account
- Milestone: multi-site accounts (post week 5)
- Depends on: MSI-03
- Use cases: none yet (no docs/use-cases.md)
- Estimate: not estimated (added 2026-10-14)
## Goal
What belongs to the site is separate from what belongs to the person.
## Definition of Done
_Agreed with the user 2026-10-14 (only the title was given; details chosen with them in chat)._
- [x] Settings is "Site settings": identity, address, custom domain, theme, plus the person's role in this site
- [x] `/account` (outside any site, linked from the user name): name, email, every site with the role in it; read-only
- [x] Editing name or password is not built (B-43)
- [x] Tests pass; independent review and verification done
## Technical notes
`AccountPage`, `SettingsPage`.
## History
2026-10-14: done. Reviewer found a request-chain-crosses-sites risk on switching (fixed by reloading on a site change) and
smaller items now in B-44. Verifier passed the API tickets; the admin ones have unit tests for the pure logic and were
checked in Chrome, with no automated component tests.
