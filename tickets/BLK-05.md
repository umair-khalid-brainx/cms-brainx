# BLK-05: TipTap integration and sanitisation on write
- Milestone: M3 (week 3)
- Depends on: BLK-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.40 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Rich text editing with TipTap, sanitised when saved.
## Definition of Done
_Confirmed with the user 2026-10-09 (D-045)._
- [x] Rich-text fields use Puck's built-in TipTap editor in the settings panel, with a toolbar of exactly: paragraph/heading/subheading, bold, italic, bulleted and numbered lists, quote, link
- [x] HTML is sanitised in the API on write (create, update, duplicate); script tags, event handlers, styles, images and `javascript:` links are stripped
- [x] The public site renders stored HTML without sanitising again
- [x] Headings, lists, quotes and links are styled the same in the editor canvas and on the public site, from `--site-*` variables only
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Root invariant 5: sanitise on write, never on read. `api/CLAUDE.md` invariant 3.
## History
2026-10-09: done (D-045). Puck's `richtext` field with a custom toolbar; `sanitize-html` on create, update and duplicate; shared typography in `cms-blocks`. Checked in a real browser (toolbar, link box, canvas) and on the public page. Verifier found a closing-tag corruption after a refused link (fixed with regression tests); the review found no XSS, plus a link-validator gap, two toolbar accessibility gaps and an unguarded non-string `html`, all fixed. Left for later: B-22, B-23. The built-in `reviewer` agent refused to run (it needs the `/build` kit's `docs/plan.md` and `docs/use-cases.md`), so a general-purpose agent did the review.
