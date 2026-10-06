# CNT-07: Next catch-all route, host resolution, render
- Milestone: M2 (week 2)
- Depends on: FND-04, CNT-06, BLK-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.45 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
The public site renders live pages from the database, with the tenant chosen by subdomain.
## Definition of Done
- [x] `corrick.lvh.me:3000/<path>` renders that site's published page from the DB
- [x] Draft, archived and missing pages return the same 404, inside the site's theme
- [x] Unknown subdomain or non-tenant host returns the platform "no site at this address" 404
- [x] Owner/Administrator can rename the subdomain in Settings; reserved names and taken names refused; old address 404s
- [x] Fixtures and `/preview` route deleted
- [x] Built and verified manually before this ticket file existed (see WORKLOG.md); no kit tests yet
## Technical notes
`web/src/proxy.ts`, `web/src/app/sites/[subdomain]/`, `api/src/public/`, `api/src/sites/`, `admin/src/pages/SettingsPage.tsx`. D-030, D-031. No caching yet (`CNT-08`).
## History
tenant from subdomain (`corrick.lvh.me:3000`) via `web/src/proxy.ts` rewrite to `/sites/[subdomain]/[[...path]]`; pages read from the DB through unauthenticated `GET /public/sites/:subdomain[/page]`, which only returns published, non-archived pages; separate 404s for unknown site vs. missing page. Also includes editable subdomains (Settings → Site Address, Owner/Administrator). Fixtures and `/preview` deleted. No caching yet (`CNT-08`); header/footer show the site name only until `GOV-04`. See D-030, D-031, `WORKLOG.md` 2026-10-06
