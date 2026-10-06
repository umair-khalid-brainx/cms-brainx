# GOV-06: Roles as data, five seeded, site members
- Milestone: M4 (week 4)
- Depends on: FND-05
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.55 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Five fixed roles with enforced permissions, and a way to add members to a site.
## Definition of Done
- [x] Five roles (`Role` enum) with hardcoded permission sets
- [x] Enforced in the API via `PermissionsGuard`, not only hidden in the UI
- [x] Team screen with invite links to add members
- [x] Built and verified manually before this ticket file existed (see WORKLOG.md); no kit tests yet
## Technical notes
`api/src/auth/permission.ts`, `api/src/team/`, `admin/src/pages/TeamPage.tsx`. D-023, D-024.
## History
5 fixed roles (`Role` enum), permission sets hardcoded and enforced via `PermissionsGuard` in the API, not just hidden UI; also built a team-invite flow beyond this ticket's literal scope (one-time links, no email infra exists) since "site members" needed a real way to get people in, not just the seed script (D-014's flagged gap) — see `DECISIONS.md` D-023. No per-author content ownership (Author/Contributor are permission tiers only, not content-scoped)
