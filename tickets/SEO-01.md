# SEO-01: SEO fields, meta rendering, Open Graph
- Milestone: M4 (week 4)
- Depends on: CNT-07
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band A (see EXECUTION_PLAN.md "Bands")
## Goal
Pages have SEO fields that render as real meta tags and Open Graph.
## Definition of Done
_Items marked Draft were written from the plan, decisions and code, not from use cases. Confirm them before `/build`._
- [ ] Draft: each page has SEO title, description and social image fields in admin
- [ ] Draft: the public page's HTML source contains them as `<title>`, meta description and `og:*` tags
- [ ] Draft: sensible fallbacks when fields are empty
- [ ] Draft: public 404 pages get a proper tab title (`BACKLOG.md` B-15)
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`generateMetadata` in `web/src/app/sites/[subdomain]/[[...path]]/page.tsx`. Page source is inspected in the pitch.
