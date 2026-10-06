# XRP-02: CI pipeline per repository
- Milestone: M1 (week 1)
- Depends on: none
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Each of `api`, `web`, `admin` and `cms-blocks` runs typecheck, lint and tests in CI on every push.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: a CI workflow per project runs install, typecheck, lint and tests
- [ ] Draft: `api` CI has a Postgres service so DB tests can run
- [ ] Draft: `web` and `admin` CI build `cms-blocks` first
- [ ] Draft: a failing check blocks merging to `main`
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`.github/workflows/`. Three independent projects in one repo (D-012): separate jobs, no shared workspace.
