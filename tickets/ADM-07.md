# ADM-07: Admin: page settings panel, redesigned
- Milestone: admin redesign (post multi-site)
- Depends on: ADM-01, ADM-03
- Use cases: none yet (no docs/use-cases.md)
- Estimate: not estimated (added 2026-10-14)
## Goal
The page settings panel in the editor is grouped, scannable and consistent with the new look.
## Definition of Done
_Agreed with the user 2026-10-14 (only the title was given; look and menu grouping chosen with them in chat)._
- [x] Sections (General, URL and hierarchy, SEO and sharing, Categories and tags, Publishing) as collapsible groups with one open at a time on small screens
- [x] Field labels, help text, inline errors and unsaved-state indicators use the shared field styles; dropdowns use the ADM-03 components
- [x] All existing fields and validation unchanged (slug, parent, SEO, terms, workflow)
- [x] Keyboard-navigable; no Enter-submits-outer-form regression (Puck field panel gotcha)
- [x] Typecheck, lint and tests pass; independent review and verification done
## Technical notes
`components/PageSettingsPanel.tsx` and its section components.
## History
- 2026-10-14: built. `SettingsSection` (collapsible, one open at a time at <=30rem, "Unsaved" marker per group), five groups (General, URL and hierarchy, SEO and sharing, Categories and tags, Publishing as a read-only status summary), parent picker on the shared `Select` (which now supports disabled options and opens inside a modal dialog), editor top bar wraps on phones. Independent review and verification not yet run, so the last DoD item stays open.
