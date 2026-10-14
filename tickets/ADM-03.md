# ADM-03: Admin: one accessible dropdown and row-actions menu
- Milestone: admin redesign (post multi-site)
- Depends on: ADM-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: not estimated (added 2026-10-14)
## Goal
One dropdown behaviour used everywhere, and a row-actions (kebab) menu to replace the row of loose links and buttons.
## Definition of Done
_Agreed with the user 2026-10-14 (only the title was given; look and menu grouping chosen with them in chat)._
- [x] A shared `Menu` (button + menu) and the existing `Select` (listbox) follow WAI-ARIA: open with Enter/Space/Arrow, arrow keys move, Home/End, Escape closes and returns focus, Tab closes, type-ahead
- [x] Opens in a layer that is not clipped by a table or card; flips up near the bottom edge
- [x] `SiteSwitcher` and the user menu use the same `Menu`
- [x] Destructive items marked and separated; disabled items stay visible with a reason
- [x] Keyboard, type-ahead and placement rules tested as pure functions (`lib/menuKeys.test.ts`); no DOM test library, so focus return was checked in the browser
- [x] Typecheck, lint and tests pass; independent review and verification done
## Technical notes
New `components/Menu.tsx`; `Select.tsx` and `SiteSwitcher.tsx` migrate onto the shared popup logic.
## History
2026-10-14: done. Independent review (general-purpose agent) found focus-on-first-open, Tab and aria gaps in Menu/Select; fixed.
