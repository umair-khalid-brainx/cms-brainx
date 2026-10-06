# CNT-04: Slug handling and per-site uniqueness
- Milestone: M1 (week 1)
- Depends on: CNT-01
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.15 days, band D (see EXECUTION_PLAN.md "Bands")
## Goal
Slugs are valid, unique within a site, and stable when a title changes.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: slugs are lowercase, URL-safe and generated server-side
- [ ] Draft: two pages in one site can't share a slug; the same slug in two different sites is allowed
- [ ] Draft: editing a page's title doesn't silently change its slug
- [ ] Draft: changing a slug is an explicit action and updates `path` (see `CNT-06`)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`api/src/content/content.service.ts` (`uniqueSlug`). Slug changes later trigger redirects (`GOV-05`).
