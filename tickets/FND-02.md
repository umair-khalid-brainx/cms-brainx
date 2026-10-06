# FND-02: Scoped repository layer
- Milestone: M1 (week 1)
- Depends on: FND-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
All content database access goes through a repository whose every method requires `siteId`.
## Definition of Done
- [x] `ContentRepository` exists; every method takes `siteId` as a required parameter
- [x] Nothing outside a `*.repository.ts` file imports `PrismaService`
- [x] No unscoped content method exists to be called
- [x] Built and verified manually before this ticket file existed (see WORKLOG.md); no kit tests yet
## Technical notes
`api/src/content/content.repository.ts`. Root `CLAUDE.md` invariant 1.
## History
`ContentRepository` (`api/src/content/content.repository.ts`); every method takes `siteId`, nothing outside it touches `PrismaService` for content; see `WORKLOG.md` 2026-09-25
