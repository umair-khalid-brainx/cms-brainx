# FND-03: Tenant invariant tests
- Milestone: M1 (week 1)
- Depends on: FND-02
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.15 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Automated tests that prove one tenant can never read or change another tenant's content.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: a test creates two sites with a page at the same path; reading as site A never returns site B's page
- [ ] Draft: update and delete scoped to site A cannot touch site B's rows
- [ ] Draft: the public read (`/public/sites/:subdomain/page`) only returns the requested site's page
- [ ] Draft: a test fails if any file outside `*.repository.ts` imports `PrismaService`
- [ ] Draft: tests run with `npm test` (or `test:e2e`) in `api` and are green
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`api/test/`, vitest. `api/CLAUDE.md` invariant 6 says a red invariant test stops other work. Path recomputation tests are added by `CNT-06`.
