# DEP-02: Domains screen, UI only
- Milestone: M5 (week 5)
- Depends on: GOV-06
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band A (re-estimated in docs/WEEK5_PLAN.md, D-064)
## Goal
A Domains screen showing a site's address and DNS instructions (UI only).
## Definition of Done
_Confirmed with the user on 2026-10-12 (docs/WEEK5_PLAN.md)._
- [ ] Settings → Domains shows the site's free address with a copy button
- [ ] An owner or administrator can add a custom domain: normalised, refused if it's ours or another site's; shown as Pending with the DNS records to add; removable
- [ ] Pending/verified is display only; nothing serves the site on its custom domain yet
- [ ] All tests pass. Reviewer approved. Verifier passed.

## Technical notes
`sites.host` is reserved for custom domains (D-030). Subdomain editing already exists in Settings (D-031).
