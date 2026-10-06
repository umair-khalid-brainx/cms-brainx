# BLK-06: Form block, submissions table, admin list
- Milestone: M3 (week 3)
- Depends on: BLK-04, FND-02
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.50 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
A working contact form block whose submissions land in admin.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [x] `ContactForm` block renders
- [ ] Draft: submitting the form on the public site stores a submission for that site
- [ ] Draft: admin lists a site's submissions; other sites' submissions are never visible
- [ ] Draft: basic spam protection (honeypot or rate limit)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
New `submissions` table via repository, public POST endpoint, admin page.
## History
`ContactForm` block built (non-functional, no submit endpoint); submissions table and admin list still todo
