# CNT-12: Pre-publish validation
- Milestone: M2 (week 2)
- Depends on: CNT-03
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Publishing is refused when a page has problems a visitor would see.
## Definition of Done
_Confirmed with the user 2026-10-07; rules chosen by Claude at the user's request._
- [x] Rules (errors, block publishing): page has no blocks; a required text field is blank
  (e.g. hero headline, CTA heading, testimonial quote, rich text with no text); a link with a
  missing label or href; an image with no `src`; a list block with zero items (FAQ, stats,
  gallery, feature grid, logo cloud, pricing, team, form fields); an unknown block type
- [x] Warning only (never blocks): an image with a `src` but no alt text
- [x] Checks run in the API: any `PATCH` that sets `status: published` (publish,
  restore-to-published, re-publish from the editor) → `422` with a per-block list
  (`{ blockIndex, blockType, blockLabel, field, message }`). Autosaves of a live page are not
  checked (would lose work mid-edit — D-036)
- [x] `GET /content/:slug/checks` returns `{ errors, warnings }` for the saved page
- [x] Saving a draft is never blocked
- [x] Editor: Publish shows the list per block when there are errors; warnings are shown but
  allow "Publish anyway". Pages-list status dropdown shows the API's errors when publish is refused
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Rules live once, in `api/src/content/publish-checks.ts` (`api` doesn't import `cms-blocks`; admin
only displays the API's result) — see the D-entry. `ContentService.update`. UI built with the
`frontend-design` / `ui-ux-pro-max` skills.
## History
2026-10-07: done. Rules in `api/src/content/publish-checks.ts` (D-036), gating every `PATCH` to
`published`; `GET /content/:slug/checks`; `PublishChecksPanel` in the editor (save → check → publish,
"Publish anyway" for warnings only) and on the Pages list (refused status change). Checked in the
browser in light and dark mode: errors-and-warning panel, warnings-only "Publish anyway", 422 from the
Pages list with "Fix in editor". The review found `cms-blocks` drew blank optional links/images as an
empty button / broken frame (TeamGrid's default photo) — fixed with `hasLink`/`hasImage`, verified on
the public site. Also fixed: publish uses the newest editor data; focus returns to Publish. Reviewer
approved on re-review; verifier passed. Not done: clicking a problem doesn't select its block in the
canvas; autosaves of live pages stay unchecked by design (D-036).
