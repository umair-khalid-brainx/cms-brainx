# ADM-02: Admin sidebar: regroup the menu
- Milestone: admin redesign (post multi-site)
- Depends on: ADM-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: not estimated (added 2026-10-14)
## Goal
The menu is grouped by what people do, instead of one flat list of eleven items.
## Definition of Done
_Agreed with the user 2026-10-14 (only the title was given; look and menu grouping chosen with them in chat)._
- [x] Three groups with headings: Content (Pages, each content type such as Posts, Media, Categories & Tags, Review), Site (Menus, Redirects, Submissions, Site settings), Admin (Team, Content types)
- [x] Dashboard sits above the groups; a group with no visible item (by role) is hidden
- [x] The Review count badge and per-type entries still work; role rules unchanged
- [x] Group order, membership and role filtering covered by a unit test of a pure `lib/navGroups.ts`
- [x] Typecheck, lint and tests pass; independent review and verification done
## Technical notes
Replaces the `navItems` array in `layouts/AdminLayout.tsx`.
## History
2026-10-14: done. Independent review (general-purpose agent) found focus-on-first-open, Tab and aria gaps in Menu/Select; fixed.
