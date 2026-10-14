# MSI-04: Admin: site switcher, New site and All sites
- Milestone: multi-site accounts (post week 5)
- Depends on: MSI-02, MSI-03
- Use cases: none yet (no docs/use-cases.md)
- Estimate: not estimated (added 2026-10-14)
## Goal
Move between sites and add one.
## Definition of Done
_Agreed with the user 2026-10-14 (only the title was given; details chosen with them in chat)._
- [x] Top-bar switcher lists every site with the person's role, marks the current one, links to All sites
- [x] "+ New site" (only for someone who owns a site) opens a dialog: title, address filled from the title and editable; errors from the API shown
- [x] Creating opens the new site; it is in the switcher at once
- [x] `/sites` lists every site (also the landing page for someone with none)
- [x] Tests pass; independent review and verification done
## Technical notes
`SiteSwitcher`, `NewSiteDialog`, `AllSitesPage`. Component behaviour was checked in Chrome, not by automated component tests.
## History
2026-10-14: done. Reviewer found a request-chain-crosses-sites risk on switching (fixed by reloading on a site change) and
smaller items now in B-44. Verifier passed the API tickets; the admin ones have unit tests for the pure logic and were
checked in Chrome, with no automated component tests.
