# BLK-01: Block registry, renderer, six blocks, theme tokens
- Milestone: M1 (week 1)
- Depends on: none
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.60 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
A typed block registry, a renderer, the first blocks and a theme-token system.
## Definition of Done
- [x] `Registry = { [T in BlockType]: BlockDefinition<T> }`: a missing component is a compile error
- [x] `BlockRenderer` renders a block list; unknown types are skipped
- [x] Theme flattens to `--site-*` CSS variables; blocks use nothing else
- [x] Built and verified manually before this ticket file existed (see WORKLOG.md); no kit tests yet
## Technical notes
`cms-blocks/src/registry.ts`, `BlockRenderer.tsx`, `theme/`. Root invariants 2 and 4.
