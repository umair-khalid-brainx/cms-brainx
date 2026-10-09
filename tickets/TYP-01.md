# TYP-01: Type builder UI
- Milestone: M3 (week 3)
- Depends on: CNT-02
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.40 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Admins create a new content type (e.g. Events) live, with no deploy.
## Definition of Done
_Confirmed with the user 2026-10-09 (week 3 plan, `docs/WEEK3_PLAN.md`; requirement: "custom page types", req. 3 blog, and "future extension through custom content types")._
- [x] A `content_types` table, read and written only through a repository that requires `siteId`; each type has a plural name, a singular name and a URL prefix, unique per site
- [x] Every site has a built-in "Posts" type at `/blog` (existing sites through the migration, except one that already has a page at `/blog`; seeded sites through the seed); it can't be deleted or have its address changed
- [x] A Types screen (owners and administrators) lists the types with their address and number of entries, and creates, renames and deletes them; the address can only change while the type has no entries, and a type with entries can't be deleted
- [x] Prefix rules: lowercase letters, digits and hyphens, 2 to 40 characters, one segment; refused when reserved, when it matches an existing page's address, or when another type uses it. A new page whose slug equals a type's prefix gets a suffix instead
- [x] A new, renamed or deleted type shows in (or leaves) the sidebar immediately, with no reload
- [x] A type's screen lists its entries with the same controls as Pages (status, archive tab, duplicate); "Add <name>" creates an entry at `/<prefix>/<slug>` that opens in the same editor; entries never appear in the Pages list
- [x] Entries record their author
- [x] Other sites' types and entries are never visible or changeable
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Content `type` discriminator (ARCHITECTURE.md "Content model"). Fields on a type are `TYP-02`; the public listing and entry header are `TYP-03`; categories and tags are `TAX-01`.
## History
2026-10-09: done (D-048). Types table and built-in Posts, site-scoped repository, prefix rules, Types screen, typed entries on the Pages screens, live sidebar. The verifier passed every item (two tenants and every role checked live). The review found races that returned 500s (fixed: address change is now atomic, unique and foreign-key violations answer 409), an unvalidated `?type=` (fixed), missing reserved words (fixed), a silent lowercase of the address (now refused), a refresh error that emptied the sidebar (fixed), and no role check on `/types` (added). Left: B-26.
