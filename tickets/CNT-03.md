# CNT-03: Publish states and transitions
- Milestone: M1 (week 1)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Pages move between draft and published, and only permitted roles can publish.
## Definition of Done
- [x] `ContentStatus` on `Content`; `PATCH /content/:slug` with `status` changes it
- [x] Moving to `published` requires `content:publish`; moving back to draft doesn't
- [x] Checked in `ContentService.update`, not only in the UI
- [x] Built and verified manually before this ticket file existed (see WORKLOG.md); no kit tests yet
## Technical notes
`api/src/content/content.service.ts`. Review states are `GOV-07`. `archived` was added later by `CNT-11` (D-032).
## History
built as part of `CNT-01`/`CNT-02` rather than as a separate pass, so this row was never updated until now. `ContentStatus` (`draft`/`published`) on `Content`; `PATCH /content/:slug` transitions it via `dto.status`; transitioning *to* `published` requires the `content:publish` permission (`ContentService.update`, checked in-service since the route-level guard can't see into the body), reverting to `draft` doesn't need it. Only two states — no "scheduled" or review-pending state, that's `GOV-07`
