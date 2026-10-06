# CNT-02: Admin content list and edit screens
- Milestone: M1 (week 1)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.15 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Admin screens to list pages and edit them, backed by the real API.
## Definition of Done
- [x] `/pages`, `/dashboard` Quick Draft and `/editor/:slug` read and write the `CNT-01` API
- [x] Puck's data shape is translated to and from the `cms-blocks` block contract at the boundary
- [x] Demo pages migrated into the database; local fixtures deleted
- [x] Built and verified manually before this ticket file existed (see WORKLOG.md); no kit tests yet
## Technical notes
`admin/src/pages/`, `admin/src/lib/contentApi.ts`. D-015, D-020, D-021, D-022.
## History
`/pages`, `/dashboard` Quick Draft, and `/editor/:slug` all read/write the real `CNT-01` API now, not `corrickPages.ts`/`localStorage`; Puck's native data shape is translated to/from the flat `cms-blocks` block contract at the boundary (D-015, implemented — see D-020); all 4 demo pages migrated into the real database and `corrickPages.ts` deleted (D-021/D-022)
