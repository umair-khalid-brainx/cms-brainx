# BLK-06: Form block, submissions table, admin list
- Milestone: M3 (week 3)
- Depends on: BLK-04, FND-02
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.50 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
A working contact form block whose submissions land in admin.
## Definition of Done
_Confirmed with the user 2026-10-06 (D-034)._
- [x] `ContactForm` block renders
- [x] Submitting the form on a public site stores a submission for that site; answers stored as JSONB, one `{ name, label, value }` per field in form order (changed from "keyed by name" at build time: JSONB objects lose key order, and the label snapshot keeps old submissions readable after a field is renamed)
- [x] The form posts to a `web` server action, which resolves the site from the host and forwards to `POST /public/sites/:subdomain/submissions`; the browser never sends a `siteId`
- [x] The API rejects a submission without `web`'s shared-secret header
- [x] Honeypot: a submission with the hidden field filled is dropped (visitor still sees success)
- [x] Rate limit in `web`: more than 5 submissions per minute from one visitor IP is refused
- [x] Required fields are enforced on the server, not only in the browser
- [x] Admin lists a site's submissions (date, page, short preview) and opens one to show every field; 50 per page with "Load more" (added at the user's request, 2026-10-06)
- [x] Another site's submissions are never visible — tested with two sites
- [x] All tests pass. Reviewer approved. Verifier passed. _(2026-10-06. Run as general agents with the kit's reviewer/verifier instructions, since the kit's own agents need `docs/plan.md` and `docs/use-cases.md`, which don't exist — D-033.)_
## Technical notes
New `submissions` table via a repository with required `siteId` (invariant #1). Public POST under
`api/src/public`. Admin list + detail page. Status and internal notes are `BLK-08`; delete, email
alerts and CSV export are backlog (B-21). See D-034.
## History
`ContactForm` block built (non-functional, no submit endpoint); submissions table and admin list still todo.
2026-10-06: scope confirmed and split — status + notes moved to `BLK-08` (D-034).
2026-10-06: reviewer APPROVED (one minor bug fixed: a field named `constructor` crashed the submit with a 500; now tested). Verifier PASS on every DoD item; honeypot and rate limit are verified by hand only, since `web` has no test runner.
2026-10-06: built. Submit endpoint, `web` server action with honeypot + rate limit, admin list and detail. `api` e2e tests (`test/submissions.e2e-spec.ts`, two sites) and a real headless-Chrome run on two hosts. See WORKLOG.
