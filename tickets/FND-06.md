# FND-06: Seed: first tenant and admin user
- Milestone: M1 (week 1)
- Depends on: FND-01, FND-05
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.10 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
A seed command creates the first tenant and its owner so a fresh database is usable.
## Definition of Done
- [x] `npm run db:seed` creates Corrick Oyster Co. (subdomain `corrick`), one owner account and a Home page
- [x] Running it twice doesn't duplicate rows (upserts)
- [x] Built and verified manually before this ticket file existed (see WORKLOG.md); no kit tests yet
## Technical notes
`api/prisma/seed.ts`. Manual command; not wired into `prisma migrate reset`.
## History
`npm run db:seed` (manual, not wired into `prisma migrate reset`'s seed hook) creates Corrick Oyster Co. and one owner account
