# GOV-01: Revisions: snapshot, list, restore
- Milestone: M4 (week 4)
- Depends on: SEO-01, TAX-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.40 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Every save keeps a revision that can be listed and restored.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [ ] A `revisions` table, read and written through the scoped repository layer
- [ ] Publish, status change and restore always record a revision of title, blocks, field values, SEO and terms
- [ ] Autosave records at most one revision per page per user every 10 minutes, updating the latest one inside the window
- [ ] The last 50 revisions per page are kept
- [ ] The editor's History panel lists revisions with time, author and reason, grouped by day
- [ ] Restore saves the current state as a revision, then replaces the content with the snapshot, keeping the page's status; a live page's confirm dialog says it will change on the site straight away
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
New `revisions` table, scoped through the repository layer.
