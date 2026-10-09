# GOV-04: Header and footer content and branding
- Milestone: M4 (week 4)
- Depends on: BLK-01, MED-03
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Edit the site's header and footer content and branding.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [ ] Settings' Site title and Tagline persist through the API (the `admin/src/data/site.ts` stand-in values go)
- [ ] Settings edits the footer note and picks a logo from the media library; a logo from another site is refused
- [ ] The public header shows the logo (alt = site name) or the name, plus the tagline; the footer shows the note
- [ ] The logo becomes the last-resort social image in `SEO-01`'s fallbacks
- [ ] Changing settings refreshes every page of that site
- [ ] Needs `site:manage`; two hosts show their own header and footer
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`web/src/site/types.ts` `settingsFromSite`, `admin/src/pages/SettingsPage.tsx`, `admin/src/data/site.ts` stand-in.
