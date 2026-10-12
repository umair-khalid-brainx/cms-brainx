# GOV-03: Nested menu builder
- Milestone: M4 (week 4)
- Depends on: CNT-06, GOV-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.90 days, band C (see EXECUTION_PLAN.md "Bands")
## Goal
Build nested navigation menus in admin.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [x] Two menu locations per site, Header and Footer, each a tree of items up to 2 levels deep
- [x] An item is a page (stored by id, so it follows slug and parent changes) or a custom link, with an editable label
- [x] The Menus screen adds, edits, removes, reorders and nests items by drag and drop and by keyboard/buttons; needs `site:manage`
- [x] Saving replaces the whole menu in one transaction and refreshes the whole site
- [x] The public header shows the menu with dropdowns that work with hover, keyboard and touch, plus a mobile menu; the footer shows top items as group titles
- [x] An item pointing at a page that isn't published is hidden publicly
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Feeds `SiteSettings.nav` in `web/src/site/types.ts` (currently always empty).
## History
2026-10-12: done (D-059). `MenuItem` (header and footer, two levels, a page by id or a link); `PUT /menus/:location` saves the whole menu in one transaction under a lock (`site:manage`) and refreshes the whole site; `api/src/menus/menu-tree.ts` holds the rules and what a visitor sees (current page address, unpublished pages hidden, a heading when only its page is hidden); a page in a menu going live, off or moving also refreshes the site. Admin Menus screen with buttons (up, down, put under, move out), mouse drag and drop with drop markers, add-a-page search and add-a-link, announcements and focus handling; public header with accessible dropdowns (hover, toggle button, Esc, outside click) and a mobile Menu; footer groups. Verified with curl on two hosts and in the browser (screen in light/dark and at tablet width; nav hover, keyboard, tap and mobile on a production build; drag and drop with synthetic drag events); verifier passed; review asked for a clear error when a page is deleted mid-save, no hover gap in the dropdown, unique keys, focus after Remove, a drag handle that works in Firefox, an empty-list guard and closing the mobile menu on a link, all done.
