# CNT-09: Preview links
- Milestone: M2 (week 2)
- Depends on: CNT-07
- Use cases: none yet (no docs/use-cases.md)
- Estimate: 0.20 days, band B (see EXECUTION_PLAN.md "Bands")
## Goal
Editors can share an unguessable link that previews a draft page on the real site, until they
revoke it.
## Definition of Done
_Confirmed with the user 2026-10-07: no expiry, revocable, one link per page (supersedes the
draft "signed, expiring token")._
- [ ] New `preview_links` table: one row per page, random 32-byte URL-safe token, cascades on page delete
- [ ] `GET/POST/DELETE /content/:slug/preview-link` (needs `content:write`): read, create-or-return, revoke
- [ ] `<subdomain>.<root>/__preview/<token>` renders the page's latest saved blocks inside the site's chrome, marked `noindex`, never cached
- [ ] Unknown or revoked token → 404; a token for site A on site B's host → 404
- [ ] The link keeps working after the page is published; archived pages → 404
- [ ] `findLiveByPath` and the public page route are unchanged (drafts stay 404 at their real path)
- [ ] Editor has a "Share preview" control: create, copy, revoke
- [ ] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`PreviewLinkRepository` (site-scoped lookups only), `/public/sites/:subdomain/preview/:token`,
`web/src/proxy.ts` maps `/__preview/<token>` (no slug can start with `_`) to a non-ISR route.
UI built with the `frontend-design` / `ui-ux-pro-max` skills.
