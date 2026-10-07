# TYP-05: Four seeded starter block arrangements
- Milestone: M2 (week 2)
- Depends on: BLK-02
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Four starter page layouts, stored as data, for `TYP-04` to offer on page creation.
## Definition of Done
_Confirmed with the user 2026-10-07._
- [ ] New global `starter_layouts` table (key, name, description, blocks, sort order), shared by every site
- [ ] Seed upserts four by key: Landing (hero, feature grid, stats, testimonial, CTA), About (hero,
  rich text, team grid, testimonial), Contact (hero, contact form, FAQ), Article (hero, rich text, CTA)
- [ ] Generic placeholder copy; every layout uses only registry block types and passes `CNT-12`'s publish checks
- [ ] `GET /starter-layouts` (logged in) returns them in order
- [ ] No admin UI (that's `TYP-04`)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Data, not code-defined blocks (root invariant 8). Not tenant content, so no `siteId` — see the
D-entry. Layout data in `api/prisma/starter-layouts.ts`, used by the seed and the test.
