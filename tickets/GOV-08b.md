# GOV-08b: Second tenant branding, content, cross-tenant bug hunt
- Milestone: M5 (week 5)
- Depends on: GOV-08a, GOV-04
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.70 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
The second tenant is fully branded with real content, and a cross-tenant bug hunt is done.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: second tenant has its own theme, header, footer and several pages
- [ ] Draft: every public and admin route is checked with both tenants for leaks
- [ ] Draft: any leak found gets an invariant test
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Depends on `GOV-08a`, `GOV-04`. Root invariant 6: test with two hosts.
