# XRP-03: Typed API client generated from OpenAPI
- Milestone: Backlog
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.30 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
A typed API client generated from the API's OpenAPI spec, replacing hand-written fetch helpers.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: `api` exposes an OpenAPI document
- [ ] Draft: `admin` (and `web`) use a generated typed client instead of hand-written types
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Backlog, not scheduled. Would replace `admin/src/lib/*Api.ts` and `web/src/lib/publicApi.ts`.
