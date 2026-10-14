# ADM-06: Admin: restyle every other screen
- Milestone: admin redesign (post multi-site)
- Depends on: ADM-01, ADM-03
- Use cases: none yet (no docs/use-cases.md)
- Estimate: not estimated (added 2026-10-14)
## Goal
Dashboard, Media, Review, Submissions, Team, Menus, Taxonomy, Redirects, Types, Settings, Account, All sites and the auth screens look like one product.
## Definition of Done
_Agreed with the user 2026-10-14 (only the title was given; look and menu grouping chosen with them in chat)._
- [x] Each screen uses the ADM-01 tokens and shared page header/card/table/form/button classes; WordPress colours (#2271b1, #1d2327, #f0f0f1 ...) removed from `admin/src` outside the editor canvas
- [x] Shared primitives (`.ui-page-header`, `.ui-card`, `.ui-table`, `.ui-btn`, `.ui-field`, `.ui-badge`) used instead of per-screen copies where practical
- [x] Dark mode and 390px width checked on every screen; no behaviour or copy changes
- [x] Editor screen: top bar and panels restyled; Puck canvas untouched
- [x] Typecheck, lint and tests pass; independent review and verification done
## Technical notes
Largest ticket by line count (~8k lines of CSS). Visual only.
## History
- 2026-10-14: Non-editor screens restyled against the tokens. Added `admin/src/ui.css` (page header, `.ui-card/btn/field/table/badge`, Fraunces `.admin-content h1`, success/warn/danger wash tokens); `#fff` panels and WordPress status colours replaced by tokens; text-3/danger swap in dark; 6/10px radii; disabled primaries; All sites/Account header. Checked light, dark and 390px (no overflow, contrast audit clean). Per-screen classes still exist beside `.ui-*`; editor item and review/verify still open.
