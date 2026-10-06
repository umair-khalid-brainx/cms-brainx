# GOV-08a: Minimal second tenant and host mapping
- Milestone: M2 (week 2)
- Depends on: FND-04, FND-06
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.15 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
A second tenant with its own subdomain, so isolation can be tested with two real hosts.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: seed creates a second site (e.g. Kestrel Rigging) with its own subdomain, theme and owner
- [ ] Draft: both sites render on their own subdomains with their own content
- [ ] Draft: neither site's admin can see the other's pages
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`api/prisma/seed.ts`. Kestrel's old fixture theme and copy were deleted with `CNT-07` (D-030); recover from git history (`web/src/fixtures/kestrel.ts` at `f161fd8`) if wanted.
