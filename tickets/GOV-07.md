# GOV-07: Submit for review and reviewer queue
- Milestone: M5 (week 5)
- Depends on: CNT-03, GOV-06
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.40 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Contributors submit pages for review; reviewers approve or send them back.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: a page can be submitted for review by a role without `content:publish`
- [ ] Draft: reviewers see a queue of submitted pages for their site
- [ ] Draft: approve publishes; reject returns to draft with a note
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Adds a review state to `ContentStatus`; check every status filter (`findMany`, `findLiveByPath`) still behaves.
