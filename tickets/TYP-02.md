# TYP-02: Six field kinds, dynamic forms, JSONB, Zod
- Milestone: M3 (week 3)
- Depends on: TYP-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.60 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Content types have custom fields of six fixed kinds, validated with Zod.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: the six field kinds can be added to a type
- [ ] Draft: the edit form is generated from the type's fields
- [ ] Draft: values are stored as JSONB and validated server-side with Zod
- [ ] Draft: a seventh field kind is out of scope (root invariant 8)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Which six kinds: confirm against the published plan.
