# FND-01: Database schema and initial migration
- Milestone: M1 (week 1)
- Depends on: none
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.25 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
A Postgres schema and first migration for sites, users, memberships and content.
## Definition of Done
- [x] Prisma schema with `Site`, `User`, `SiteMembership`, `Content`; migration applies to an empty database
- [x] `content` is unique per `(site_id, path)`
- [x] Generated client compiles; `api` typechecks
- [x] Built and verified manually before this ticket file existed (see WORKLOG.md); no kit tests yet
## Technical notes
`api/prisma/schema.prisma`, `api/prisma/migrations/`. MVP slice only; later tickets add their own models.
## History
(MVP slice — 4 models, not the full eventual schema; see `WORKLOG.md` 2026-09-25)
