# CNT-01: Content CRUD API, tenant-scoped
- Milestone: M1 (week 1)
- Depends on: FND-02
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
A tenant-scoped REST API to list, create, read and update pages.
## Definition of Done
- [x] `GET/POST /content`, `GET/PATCH /content/:slug`, all behind `JwtAuthGuard`
- [x] `siteId` comes from the caller's membership, never from the request
- [x] Server-side slugify with collision suffixing
- [x] Built and verified manually before this ticket file existed (see WORKLOG.md); no kit tests yet
## Technical notes
`api/src/content/`.
## History
`GET/POST /content`, `GET/PATCH /content/:slug`, `JwtAuthGuard`-protected; `siteId` resolved server-side from the caller's site membership, never trusted from the request; server-side slugify with collision suffixing; see `WORKLOG.md` 2026-09-25
