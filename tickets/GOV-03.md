# GOV-03: Nested menu builder
- Milestone: M4 (week 4)
- Depends on: CNT-06, GOV-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.90 days, band C (see EXECUTION_PLAN.md "Bands")
## Goal
Build nested navigation menus in admin.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [ ] Two menu locations per site, Header and Footer, each a tree of items up to 2 levels deep
- [ ] An item is a page (stored by id, so it follows slug and parent changes) or a custom link, with an editable label
- [ ] The Menus screen adds, edits, removes, reorders and nests items by drag and drop and by keyboard/buttons; needs `site:manage`
- [ ] Saving replaces the whole menu in one transaction and refreshes the whole site
- [ ] The public header shows the menu with dropdowns that work with hover, keyboard and touch, plus a mobile menu; the footer shows top items as group titles
- [ ] An item pointing at a page that isn't published is hidden publicly
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Feeds `SiteSettings.nav` in `web/src/site/types.ts` (currently always empty).
