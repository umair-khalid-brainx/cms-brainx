# GOV-05: Redirect engine and auto-redirect on slug change
- Milestone: M4 (week 4)
- Depends on: CNT-06
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.40 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Redirects, including an automatic one when a slug changes.
## Definition of Done
_Confirmed with the user 2026-10-09 (`docs/WEEK4_PLAN.md`, D-052)._
- [ ] A `redirects` table per site: from path, to path or URL, source (auto or manual), who and when
- [ ] A slug or parent change on a page that was ever published creates a redirect for every moved path in its subtree
- [ ] Redirects never chain: adding B → C rewrites any X → B to X → C; a loop is refused
- [ ] A page always beats a redirect: when a page takes a path (any status), any redirect from that path is removed before chains are flattened, so renaming back to an old slug never loops
- [ ] The public site answers a redirected path with a permanent redirect (308, D-052) to the right place; creating or deleting one refreshes the cached path
- [ ] A Redirects screen lists from → to with an Auto/Manual badge and date, adds manual ones with validation, and deletes; needs `content:publish`
- [ ] Checked with `curl -I` on two hosts; no redirect crosses tenants
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
Depends on `CNT-04`. Subdomain renames deliberately don't redirect (D-031).
