# BLK-03: Editor canvas (Puck): add, delete, reorder, duplicate
- Milestone: M2 (week 2)
- Depends on: XRP-01, CNT-02
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 1.00 days, band C (see EXECUTION_PLAN.md "Bands")
## Goal
Editors can add, delete, reorder and duplicate blocks on the Puck canvas.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [x] Canvas lists all 14 blocks and saves to a real page
- [x] Draft: add a block from the sidebar and it appears on the canvas and persists after save
  _(unit tests in `admin/src/lib/contentApi.test.ts`; real drag in Chrome on 2026-10-06, see History)_
- [x] Draft: delete, reorder (drag) and duplicate each work and persist
  _(unit tests in `admin/src/lib/contentApi.test.ts`; real clicks/drag in Chrome on 2026-10-06, see History)_
- [ ] Draft: verified by a person in a real browser (not headless) — the user does this pass themselves
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`admin/src/pages/EditorPage.tsx`, `admin/src/puck/config.tsx`. D-013.
## History
canvas built with all 14 real blocks, now wired to a real content record via `CNT-02`; add/delete/reorder/duplicate themselves not yet interactively tested at that point

2026-10-06: persistence tests added (D-041) — 26 vitest tests in `admin/src/lib/contentApi.test.ts` save and reload each canvas action through the real `saveDraft`/`publishPage`/`getPage` against an in-memory API. All pass; each was confirmed to fail when the translation code was deliberately broken (shared ids, reversed order, leaked Puck ids). Still open: manual browser pass by the user, reviewer, verifier.

2026-10-06: driven in real Chrome (headless, trusted mouse input over the DevTools protocol) on a throwaway page `blk-03-canvas-test` — dragged Hero, RichText, Faq from the sidebar; duplicated Hero via the action bar; deleted RichText; dragged Faq to the top; reloaded; published. After every step the canvas and `GET /content/:slug` agreed: final `[faq, hero, hero]`, 3 unique ids, status `published`. Still open: the user's own hands-on browser pass, reviewer, verifier.
