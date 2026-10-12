# GOV-04: Header and footer content and branding
- Milestone: M4 (week 4)
- Depends on: BLK-01, MED-03
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Edit the site's header and footer content and branding.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [x] Settings' Site title and Tagline persist through the API (the `admin/src/data/site.ts` stand-in values go)
- [x] Settings edits the footer note and picks a logo from the media library; a logo from another site is refused
- [x] The public header shows the logo (alt = site name) or the name, plus the tagline; the footer shows the note
- [x] The logo becomes the last-resort social image in `SEO-01`'s fallbacks
- [x] Changing settings refreshes every page of that site
- [x] Needs `site:manage`; two hosts show their own header and footer
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`web/src/site/types.ts` `settingsFromSite`, `admin/src/pages/SettingsPage.tsx`, `admin/src/data/site.ts` stand-in.
## History
2026-10-12: done (D-058). `Site.settings` (tagline, footer note, logo) with the title still in `Site.name`; `PATCH /sites/:siteId/settings` (`site:manage`); the Settings screen's Site Identity card replaces the placeholder form; the public header shows the logo (alt = site name) and tagline, the footer the note; the logo is the last social-image fallback (pages and listings). A settings change refreshes every page of the site by cache tag (a path refresh didn't reach the site data every page reads, nor the page tags built from the site name and logo). Verified with curl on two hosts (persistence, refusals, tenant isolation, a real Contributor getting 403, the very next request showing the change on every page) and in the browser (light/dark, desktop/tablet, the site name in the admin top bar updating at once); verifier passed; review asked for a 400 on a malformed revalidate path, accessible names on the logo buttons, other tabs following a rename, and the stored logo path re-checked on read, all done. The commit gate then asked for the logo to count as in use (warning before deleting its file, and cleared with a site refresh when deleted), one shared check for what a usable picture is, a lazy logo lookup, and a 400 for a primitive revalidate body; all done and checked live.
