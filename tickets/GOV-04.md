# GOV-04: Header and footer content and branding
- Milestone: M4 (week 4)
- Depends on: BLK-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Edit the site's header and footer content and branding.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: admin edits tagline, footer note and footer link groups, saved via the API
- [ ] Draft: the public header and footer show them (today they show the site name only)
- [ ] Draft: Settings' Site Title and Tagline actually persist
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`web/src/site/types.ts` `settingsFromSite`, `admin/src/pages/SettingsPage.tsx`, `admin/src/data/site.ts` stand-in.
