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
- [x] New `preview_links` table: one row per page, random 32-byte URL-safe token, cascades on page delete
- [x] `GET/POST/DELETE /content/:slug/preview-link` (needs `content:write`): read, create-or-return, revoke
- [x] `<subdomain>.<root>/__preview/<token>` renders the page's latest saved blocks inside the site's chrome, marked `noindex`, never cached
- [x] Unknown or revoked token → 404; a token for site A on site B's host → 404
- [x] The link keeps working after the page is published; archived pages → 404, and a link can't be created for one (409)
- [x] `findLiveByPath` and the public page route are unchanged (drafts stay 404 at their real path)
- [x] Editor has a "Share preview" control: create, copy, revoke
- [x] All tests pass. Reviewer approved. Verifier passed.
## Technical notes
`PreviewLinkRepository` (site-scoped lookups only), `/public/sites/:subdomain/preview/:token`,
`web/src/proxy.ts` maps `/__preview/<token>` (no slug can start with `_`) to a non-ISR route.
UI built with the `frontend-design` / `ui-ux-pro-max` skills.
## History
2026-10-07: done (D-037). `preview_links` (hand-written migration, checked with `prisma migrate diff`
→ empty), `PreviewLinkRepository` (all lookups site-scoped), three `/content/:slug/preview-link`
routes, `GET /public/sites/:subdomain/preview/:token` (`no-store`, `noindex`). `web` maps
`/__preview/<token>` to a `force-dynamic` route with the site's chrome and a "Private preview" strip
(screenshot checked in headless Chrome). Editor "Share preview" popover checked in light and dark
mode: create → focus on the link, copy (falls back to selecting the link when the clipboard is
refused), Escape closes and returns focus. Reviewer approved (should-fixes applied: focus after
create/revoke, service tests, `cache()` on `getPreview`, `no-referrer`); verifier passed.
