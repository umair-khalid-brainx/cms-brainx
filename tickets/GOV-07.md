# GOV-07: Submit for review and reviewer queue
- Milestone: M5 (week 5)
- Depends on: CNT-03, GOV-06
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.90 days, band C (re-estimated in docs/WEEK5_PLAN.md, D-064)
## Goal
Contributors submit pages for review; reviewers approve or send them back.
## Definition of Done
_Confirmed with the user on 2026-10-12 (docs/WEEK5_PLAN.md)._
- [ ] A role with `content:write` (Contributor included) can submit a draft for review; while in review or scheduled the page is locked (saves refused with 409) and the submitter or a reviewer can withdraw it to draft
- [ ] Owner, Administrator and Editor (`content:review`) see a Review screen of their site's submitted pages, with a count in the sidebar; Pages shows an "In review" status and filter
- [ ] Approve runs the pre-publish checks and publishes now or at a chosen date and time; reject needs a note, returns the page to draft, and the note shows in the editor
- [ ] Publishers can schedule a draft directly, unschedule it, or publish it now; a scheduled page goes live within about a minute of its time, once, with the same refreshes as a manual publish; if it fails the checks then, it returns to draft with a note
- [ ] A Viewer role exists with `content:read` only: every write route answers 403, and the admin hides write actions
- [ ] Each workflow step records a revision with who did it; in-review and scheduled pages never appear on the public site, sitemap, menus or archives (two hosts)
- [ ] All tests pass. Reviewer approved. Verifier passed.

## Technical notes
Adds a review state to `ContentStatus`; check every status filter (`findMany`, `findLiveByPath`) still behaves.
