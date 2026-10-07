# BLK-08: Submission status and internal notes
- Milestone: M3 (week 3)
- Depends on: BLK-06
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.40 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Client staff can track and discuss each contact form submission inside admin.
## Definition of Done
_Confirmed with the user 2026-10-06 (D-034)._
- [ ] Staff can change a submission's status: New → Read → Handled
- [ ] Staff can add internal notes to a submission; each note shows its author and time
- [ ] The visitor's answers cannot be edited
- [ ] Notes and status are never visible on the public site or to another site's staff — tested with two sites
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Split out of `BLK-06` (D-034). Notes table via a repository with required `siteId`.
## History
2026-10-06: created when `BLK-06` was split.
