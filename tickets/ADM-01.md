# ADM-01: Admin design tokens and shell
- Milestone: admin redesign (post multi-site)
- Depends on: none
- Use cases: none yet (no docs/use-cases.md)
- Estimate: not estimated (added 2026-10-14)
## Goal
One set of design tokens (colour, type, radius, spacing, shadow, focus ring) and a restyled shell (sidebar, top bar, content frame) that every admin screen inherits.
## Definition of Done
_Agreed with the user 2026-10-14 (only the title was given; look and menu grouping chosen with them in chat)._
- [x] Tokens as CSS custom properties in `admin/src/index.css`: calm light theme (cool-grey surfaces, ink text, one teal accent), a dark-mode set, status colours
- [x] IBM Plex Sans body, Fraunces page titles (already loaded in index.html); a type scale
- [x] Light sidebar, top bar and content frame restyled from the tokens; no hard-coded WordPress colours left in the shell
- [x] Visible keyboard focus ring everywhere; `prefers-reduced-motion` respected; text contrast >= 4.5:1 in both modes
- [x] Shell works at 390px (sidebar becomes a drawer) with no horizontal scroll
- [x] Block canvas and `--site-*` theme preview are untouched (invariant 2)
- [x] Typecheck, lint and tests pass; independent review and verification done
## Technical notes
Admin chrome only. Tokens are named `--ui-*` so they cannot clash with the tenant `--site-*` variables.
## History
2026-10-14: done. Independent review (general-purpose agent) found focus-on-first-open, Tab and aria gaps in Menu/Select; fixed.
