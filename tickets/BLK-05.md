# BLK-05: TipTap integration and sanitisation on write
- Milestone: M3 (week 3)
- Depends on: BLK-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.40 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Rich text editing with TipTap, sanitised when saved.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: rich-text fields use a TipTap editor in the settings panel
- [ ] Draft: HTML is sanitised in the API on write; script tags and event handlers are stripped
- [ ] Draft: the public site renders stored HTML without sanitising again
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Root invariant 5: sanitise on write, never on read. `api/CLAUDE.md` invariant 3.
