# GOV-03: Nested menu builder
- Milestone: M4 (week 4)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.90 days, band C (see EXECUTION_PLAN.md "Bands")
## Goal
Build nested navigation menus in admin.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: create a menu, add pages or custom links, nest and reorder them
- [ ] Draft: the public header renders the menu
- [ ] Draft: a menu link to a draft or archived page is hidden publicly
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Feeds `SiteSettings.nav` in `web/src/site/types.ts` (currently always empty).
