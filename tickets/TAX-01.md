# TAX-01: Categories and tags, opt-in per type
- Milestone: M4 (week 4)
- Depends on: TYP-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Categories and tags that a content type can opt into.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [x] One flat list of categories and one of tags per site, shared by every type that opts in
- [x] A type can switch categories and/or tags on; the seeded Posts type has both on, new types start with both off
- [x] Entries of an opted-in type can be given categories (checkboxes) and tags (token input; a new tag can be created while tagging) in Page settings
- [x] A Categories & Tags screen adds, renames and deletes terms and shows entry counts; deleting a term unlinks it
- [x] Terms from another site, or on a type that hasn't opted in, are refused
- [x] All tests pass (api 572, admin 153)
- [x] Reviewer approved. Verifier passed. (2026-10-12: reviewer asked for 3 fixes, all made; verifier passed all items)
## Verification (2026-10-12)
Built and exercised live against `cms_wk4`: see `docs/WORKLOG.md` and D-060. Reviewer and verifier have not run yet.

## Technical notes
Depends on content types (`TYP-01`).
