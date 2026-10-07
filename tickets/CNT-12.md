# CNT-12: Pre-publish validation
- Milestone: M2 (week 2)
- Depends on: CNT-03
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Publishing is refused when a page has problems a visitor would see.
## Definition of Done
_Confirmed with the user 2026-10-07; rules chosen by Claude at the user's request._
- [ ] Rules (errors, block publishing): page has no blocks; a required text field is blank
  (e.g. hero headline, CTA heading, testimonial quote, rich text with no text); a link with a
  missing label or href; an image with no `src`; a list block with zero items (FAQ, stats,
  gallery, feature grid, logo cloud, pricing, team, form fields); an unknown block type
- [ ] Warning only (never blocks): an image with a `src` but no alt text
- [ ] Checks run in the API: any `PATCH` whose result is a published page with new blocks
  (publish, restore-to-published, or saving a live page) → `422` with a per-block list
  (`{ blockIndex, blockType, field, message }`)
- [ ] `GET /content/:slug/checks` returns `{ errors, warnings }` for the saved page
- [ ] Saving a draft is never blocked
- [ ] Editor: Publish shows the list per block when there are errors; warnings are shown but
  allow "Publish anyway". Pages-list status dropdown shows the API's errors when publish is refused
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Rules live once, in `api/src/content/publish-checks.ts` (`api` doesn't import `cms-blocks`; admin
only displays the API's result) — see the D-entry. `ContentService.update`. UI built with the
`frontend-design` / `ui-ux-pro-max` skills.
