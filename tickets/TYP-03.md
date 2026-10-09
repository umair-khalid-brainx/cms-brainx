# TYP-03: Type-driven routing
- Milestone: M3 (week 3)
- Depends on: TYP-01, CNT-07
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Entries of a new type are reachable on the public site at their prefix.
## Definition of Done
_Confirmed with the user 2026-10-09 (week 3 plan: an automatic entry header and a simple newest-first listing; D-050)._
- [ ] `/<type prefix>/<slug>` renders a published entry: title, author's name, publish date, then its fields, with the entry's own blocks below
- [ ] `/<type prefix>` lists that type's published entries, newest first, each linking to its page, with date, summary and picture when it has them
- [ ] No new route files or deploys are needed per type: the existing catch-all route serves entries and listings
- [ ] Drafts, archived entries and other sites' entries and types never appear, in a page or a listing (a missing type is the same 404 as a missing page)
- [ ] Only the author's name is public, never their email; media files are shown from the site's own library with the library's alt text
- [ ] Publishing, unpublishing or archiving an entry refreshes both its page and its type's listing
- [ ] The header and list use the site's theme only, work on a phone, and look different on two tenants
- [ ] A private preview link shows an entry with its header too
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Extends `web/src/app/sites/[subdomain]/[[...path]]`, `findLiveByPath` and a new `GET /public/sites/:sub/types/:prefix`. Components `EntryHeader` and `EntryList` in `cms-blocks`. D-050.
