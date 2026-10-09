# Backlog

Ad-hoc fixes, off-main-flow requests, feedback and ideas. Scheduled feature work lives in
`EXECUTION_PLAN.md`; this file exists so small asks do not get lost.

Status: **open** / **done** (with date) / **accepted** (deliberately not acting).

---

## Open

| # | Item | Raised | Notes |
| - | ---- | ------ | ----- |
| B-02 | **Scope doc §11 says "22-day / 4.5-week commitment"** while every other figure says 25 days / ~5 weeks. Leftover from Revision 1. | 2026-08-31 | Fix in the source `.docx` |
| B-03 | **Scope doc block count reads as a contradiction** — §5 lists 11 blocks (form included), §6 prices "10 shared block components" plus the form block separately. Numerically consistent, confusing as written. | 2026-08-31 | Reword to "10 blocks + form block" |
| B-05 | **`api/.agents/` holds 424 KB of Prisma's own agent skill docs**, added by `prisma init`. Keep or delete. | 2026-08-28 | Empty `.claude/` and `.windsurf/` dirs it also created were removed; `prisma generate` recreates them |
| B-06 | **Device-width preview toggle in the editor** (desktop / tablet / mobile) becomes nearly free once the canvas is in an iframe, since `@media` measures the iframe. | 2026-08-31 | Good pitch moment; fold into `BLK-03` if cheap, otherwise a new ticket |
| B-11 | **No "transfer ownership" flow.** A site's Owner is now permanent — `TeamService` refuses to change an Owner's role or promote anyone else to Owner (`DECISIONS.md` D-024) — so there's currently no way to hand a site to a different real owner short of direct DB access. | 2026-09-25 | Real gap for a production system, not needed yet for this POC |
| B-12 | **Deleting a media file doesn't warn if it's still referenced on a page.** `/media`'s Delete (D-026) just deletes; a page still using that URL is left with a broken image. Needs either a join table kept in sync on content saves, or a runtime scan of `Content.blocks` JSONB. Also: no "replace in place" (delete + re-upload only — reuse itself is covered now, `MED-03`/D-027). | 2026-09-28 | **Delete warning and replace-in-place done 2026-10-07** (`MED-02`, D-044); thumbnails done 2026-10-07 (`MED-01`, D-043) |
| B-15 | **Public 404 pages have a generic browser-tab title** ("CMS — tenant site renderer", the root layout's default) instead of e.g. "Page not found · Corrick Oyster Co.". `not-found.tsx` gets no route params, so the site name isn't directly available there. | 2026-10-06 | Cosmetic. Natural to fix alongside `SEO-01` (meta rendering) |
| B-16 | **Editor canvas always uses Corrick's theme.** `admin/src/puck/config.tsx` hard-codes `corrickTheme` in `root.render`, so Kestrel's pages are edited in Corrick's green. Found during `CNT-12` once a second tenant existed (`GOV-08a`). | 2026-10-07 | Read `themeJson` from the site API instead; the config comment already says so |
| B-17 | **The ISR cache can be filled by anyone.** Since `CNT-08`, every unknown path or `*.<root>` subdomain renders a 404 that Next caches on disk, so a crawler or attacker can grow `.next/cache` without limit; under `no-store` this didn't exist. | 2026-10-07 | Before launch: don't cache 404s for unknown sites, or cap and evict the cache, or put rate limiting in nginx (D-039) |
| B-18 | **Block `/__revalidate` at nginx** so only `api` (over localhost) can reach it; today the shared secret is its only guard and it answers on every public host. | 2026-10-07 | Part of `DEP-01b`'s nginx config (D-039) |
| B-20 | **Puck's default page-level `title` field shows in the sidebar** when no block is selected, but `contentApi.ts` never saves `root.props`, so typing in it does nothing. | 2026-10-06 | Hide it (`root.fields: {}`) or wire it to the page title |
| B-21 | **Contact form submissions: delete, email alerts, CSV export.** Deliberately left out of `BLK-06`/`BLK-08` (D-042). | 2026-10-06 | Email alerts need a mail provider |
| B-22 | **Rich text saved before `BLK-05` is not sanitised until it is saved again.** Sanitising runs on write (D-045), so older rows stay as stored, and a `PATCH` that sends only `status: published` (no `blocks`) publishes them untouched. Harmless today (seed content is clean), but needs a one-off script that re-saves every `richText` block, or sanitising `existing.blocks` on publish, before real tenants exist. | 2026-10-09 | Found by the `BLK-05` review |
| B-23 | **The rich-text sanitiser drops what the toolbar can't make, without converting it.** Pasting through the editor is already normalised by TipTap, but HTML sent straight to the API has `<h1>`, `<h4>`–`<h6>` and `<div>` flattened to bare text, and `tel:` links turned into plain text. Map `h1`→`h2`, `h4`–`h6`→`h3`, `div`→`p`, and decide whether `tel:` is wanted (not in the requirements). | 2026-10-09 | Low: only reachable by sending HTML directly to the API |
| B-24 | **Empty text can't be filled in place, and the canvas shows blank structure the public site doesn't.** Puck passes an editable node even for an empty field, so every `value ? <wrapper>` check is true in the canvas: extra gaps from an empty hero eyebrow or body, a bordered empty video caption strip, an empty heading area in the feature grid, FAQ, team and pricing blocks, a lone "—" in the testimonial. The zero-size field can't be clicked, so an emptied headline must be refilled from the sidebar. Fix by giving empty editable fields a minimum size and placeholder, or by having the block hide its wrapper only on the public site. | 2026-10-09 | Found while building `BLK-07` (D-046) |
| B-25 | **Two gaps in media alt text and uploads (`MED-04`).** (1) A page can't mark an image decorative: an empty alt means "use the library's", so a decorative image whose library file has alt text gets announced. Add a per-image "decorative" switch. (2) A `.docx` or `.xlsx` the operating system labels with no type or `application/octet-stream` is refused; accept by extension, then check the signature. | 2026-10-09 | Found by the `MED-04` review (D-047) |

## Accepted — deliberately not acting

| # | Item | Decided | Reasoning |
| - | ---- | ------- | --------- |
| B-08 | `npm audit` reports 5 findings in `api` dev-only transitive deps (`tmp` via the Nest CLI, `undici`). | 2026-08-28 | Dev tooling only, and `audit fix --force` would take breaking major bumps on a fresh scaffold. Revisit before deploy (`DEP-01b`) |
| B-09 | Stale cached 308 redirect from `localhost:3000` to `/en`, left by an unrelated project on that origin. | 2026-08-31 | Not a bug in this project. Workaround: use `127.0.0.1:3000`, or clear site data with "unregister service workers" |

## Done

| # | Item | Done | Notes |
| - | ---- | ---- | ----- |
| B-01 | Docs were unversioned. | 2026-09-24 | Resolved by folding `api`/`web`/`admin` into one repo at `CMS/` root — see `DECISIONS.md` D-012 |
| B-04 | Commit the three repos. | 2026-09-24 | Superseded by B-01's fix — one repo, one initial commit, instead of three |
| B-10 | Dashboard "Visit Site" link (opens `web`'s preview of the current site in a new tab) and a basic `/settings` screen (site identity fields, read-only account info). | 2026-09-25 | Ad-hoc, no `EXECUTION_PLAN.md` ticket covers a site-settings screen. Settings form doesn't persist — no settings API exists |
| B-07 | Delete the dev-only routes `/` comparison view and `/preview/[site]`. | 2026-10-06 | Deleted with `web/src/fixtures/` when `CNT-07`'s subdomain route landed (D-030) |
| B-13 | No restore for an archived page (D-029 left `archivedAt` a one-way door). | 2026-10-06 | Pages list rows now carry a status dropdown — an archived page can move back to Draft or Published. `archived` became a real `ContentStatus` value (D-032) |
| B-14 | Let site staff change their site's subdomain. | 2026-10-06 | Built into `CNT-07`: Settings → Site Address, Owner/Administrator only, reserved names, old address dies (D-031) |
| B-19 | Editor Outline panel text nearly invisible, and canvas below the last block black, in OS dark mode. | 2026-10-06 | Puck's Outline rows use `color: inherit` and picked up `index.css`'s dark-mode `--foreground` (`#ededed`) on Puck's white panel. `.editor-puck` now sets `color: var(--puck-color-text)`, the same token Puck's block list uses (`EditorPage.css`). Same cause turned the canvas below the last block black; the editor's `SiteThemeRoot` now gets `min-h-screen` like `web`'s `SiteChrome`, so the site's paper fills it |
