# XRP-01: Shared block package
- Milestone: M1 (week 1)
- Depends on: DEC-1 (open decision, see EXECUTION_PLAN.md)
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.55 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Block components live in one shared package used by both `web` and `admin`.
## Definition of Done
- [x] `cms-blocks` package with registry, renderer, blocks and theme
- [x] `web` and `admin` both depend on it via a local `file:` dependency and render the same components
- [x] No block component is copied into a second repo
- [x] Built and verified manually before this ticket file existed (see WORKLOG.md); no kit tests yet
## Technical notes
`cms-blocks/`. Fresh clones must run `npm run build` in it (gotcha in root `CLAUDE.md`). D-008, D-016.
## History
(local `file:` dep, not published — see `DECISIONS.md` D-016)
