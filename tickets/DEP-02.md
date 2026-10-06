# DEP-02: Domains screen, UI only
- Milestone: M5 (week 5)
- Depends on: GOV-06
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.15 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
A Domains screen showing a site's address and DNS instructions (UI only).
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: shows the site's subdomain and any custom domain with DNS instructions
- [ ] Draft: pending/verified status is display only; no automation
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`sites.host` is reserved for custom domains (D-030). Subdomain editing already exists in Settings (D-031).
