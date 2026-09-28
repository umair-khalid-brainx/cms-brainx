# Execution plan — ticket tracker

Status surface for the 5-week build. Full narrative, acceptance criteria and risk register:
**https://claude.ai/code/artifact/a86e0066-2565-4026-b18d-faf2802f0890**

Update the Status column as tickets move. Log completion in `WORKLOG.md`, decisions in
`DECISIONS.md`. Estimates are 8-hour engineer-days including specification and review.

Last re-baselined: 2026-08-31 (`DECISIONS.md` D-009).

## Bands

| Band | Speedup | Meaning for review |
| ---- | ------- | ------------------ |
| A | 4&ndash;5&times; | Generative: schema, CRUD, forms, seeds. Skim review. |
| B | 3&times; | Integrated: touches two or three subsystems. Integration errors need a human. |
| C | 1.5&ndash;2&times; | Interactive: editor, drag-and-drop. Needs human visual iteration. |
| D | 1.2&times; | Diagnostic: leaks, cache keys, path recomputation. Review line by line. |
| E | 1&ndash;1.3&times; | Environmental: EC2, nginx, DNS, demo content. The agent cannot see the server. |

## Totals

| | Days |
| - | ---- |
| Delivered (scaffold 0.25 + BLK-01 0.60) | 0.85 |
| Remaining, raw | **19.50** |
| Commitment | 25 working days |
| Slack inside the commitment | 5.50d (28% contingency) |

53 tickets committed, 1 in backlog (`XRP-03`).

## Weeks and gates

| Week | Gate | Planned | Slack | State if stopped here |
| ---- | ---- | ------- | ----- | --------------------- |
| 1 | **Foundation provable** | 3.85d | 1.15d | Tenant isolation proved by test, schema settled, skeleton deployed on the real domain. Nothing visible on screen. |
| 2 | **Edit &rarr; publish &rarr; live** | 3.55d | 1.45d | The loop closes on the deployed box with two tenants resolving. Demoable, not impressive. |
| 3 | **This is the pitch** | 3.90d | 1.10d | Block editor with settings, inline editing and rich text; forms; custom types routing with no deploy; media library. |
| 4 | **Looks like a product** | 3.65d | 1.35d | SEO surface, sitemaps, redirects, taxonomy, revisions, menus, five real roles. |
| 5 | **Deployed, seeded, rehearsed** | 4.55d | 0.45d | Review workflow, second tenant fully branded, deploy with rollback, convincing content, demo run three times. |

Cut order if a week overruns: **GOV-02** (revision comparison), then **GOV-03** (menu builder), then block count in **BLK-02**. All three demo well and nothing depends on them.

## Open decisions

| ID | Decision | Owner | Needed by | Blocks | Status |
| -- | -------- | ----- | --------- | ------ | ------ |
| DEC-1 | How blocks are shared between editor and public renderer | Saad | Day 2 | XRP-01, BLK-03, BLK-04 | **resolved 2026-08-31** &mdash; D-008 |
| DEC-2 | Domain with DNS control for a wildcard record | CEO | Day 3 | DEP-01a, CNT-08 | open |
| DEC-3 | Two demo tenant identities: industry, brand, content direction | CEO | End of week 3 | GOV-08b, DEP-03 | open &mdash; placeholders in code |
| DEC-4 | Confirm the out-of-scope list | CEO | Day 3 | everything | open |
| DEC-5 | Production API subdomain and port | Saad | Week 5 | DEP-01b | open |

## Tickets

### FND — Foundation  ·  1.35d  ·  api

The invariants everything else is built on. Nothing here is demoable — say so in the daily report rather than appearing to stall.

| ID | Ticket | Band | Days | Wk | Depends on | Status |
| -- | ------ | ---- | ---- | -- | ---------- | ------ |
| `FND-01` | Database schema and initial migration | A | 0.25 | 1 | — | ✅ done (MVP slice — 4 models, not the full eventual schema; see `WORKLOG.md` 2026-09-25) |
| `FND-02` | Scoped repository layer | D | 0.30 | 1 | FND-01 | ✅ done — `ContentRepository` (`api/src/content/content.repository.ts`); every method takes `siteId`, nothing outside it touches `PrismaService` for content; see `WORKLOG.md` 2026-09-25 |
| `FND-03` | Tenant invariant tests | D | 0.15 | 1 | FND-02 | ⬜ todo |
| `FND-04` | Host to site resolution with cache | B | 0.20 | 1 | FND-01 | ⬜ todo |
| `FND-05` | Auth: JWT, login, guards, role decorators | B | 0.35 | 1 | FND-01 | ✅ done — `POST /auth/login`, `GET /auth/me`, `JwtAuthGuard` wired to the real `admin` login page (bcrypt hash, JWT, localStorage session, route guard, forced re-login on an expired/invalid token). Role decorators landed with `GOV-06`: `PermissionsGuard` + `@RequirePermission(...)`, checked in the API against a hardcoded per-role permission map, not just hidden UI — see `DECISIONS.md` D-023. This row previously said role enforcement didn't exist yet; stale as of `GOV-06` landing the same day, corrected 2026-09-28 |
| `FND-06` | Seed: first tenant and admin user | A | 0.10 | 1 | FND-01, FND-05 | ✅ done — `npm run db:seed` (manual, not wired into `prisma migrate reset`'s seed hook) creates Corrick Oyster Co. and one owner account |

### XRP — Cross-repo platform  ·  0.85d  ·  all three

Work created by splitting the monorepo into three independent repositories. Not in the original estimate; it is the cost of that decision.

| ID | Ticket | Band | Days | Wk | Depends on | Status |
| -- | ------ | ---- | ---- | -- | ---------- | ------ |
| `XRP-01` | Shared block package | B | 0.55 | 1 | DEC-1 | ✅ done (local `file:` dep, not published — see `DECISIONS.md` D-016) |
| `XRP-02` | CI pipeline per repository | A | 0.30 | 1 | — | ⬜ todo |
| `XRP-03` | Typed API client generated from OpenAPI | B | 0.30 | — | CNT-01 | 🅱 backlog |

### CNT — Content loop  ·  2.95d  ·  api + web + admin

Edit, publish, live. Once this closes there is always something demonstrable — it is the safety net for every week after.

| ID | Ticket | Band | Days | Wk | Depends on | Status |
| -- | ------ | ---- | ---- | -- | ---------- | ------ |
| `CNT-01` | Content CRUD API, tenant-scoped | A | 0.20 | 1 | FND-02 | ✅ done — `GET/POST /content`, `GET/PATCH /content/:slug`, `JwtAuthGuard`-protected; `siteId` resolved server-side from the caller's site membership, never trusted from the request; server-side slugify with collision suffixing; see `WORKLOG.md` 2026-09-25 |
| `CNT-02` | Admin content list and edit screens | A | 0.15 | 1 | CNT-01 | ✅ done — `/pages`, `/dashboard` Quick Draft, and `/editor/:slug` all read/write the real `CNT-01` API now, not `corrickPages.ts`/`localStorage`; Puck's native data shape is translated to/from the flat `cms-blocks` block contract at the boundary (D-015, implemented — see D-020); all 4 demo pages migrated into the real database and `corrickPages.ts` deleted (D-021/D-022) |
| `CNT-03` | Publish states and transitions | D | 0.20 | 1 | CNT-01 | ✅ done — built as part of `CNT-01`/`CNT-02` rather than as a separate pass, so this row was never updated until now. `ContentStatus` (`draft`/`published`) on `Content`; `PATCH /content/:slug` transitions it via `dto.status`; transitioning *to* `published` requires the `content:publish` permission (`ContentService.update`, checked in-service since the route-level guard can't see into the body), reverting to `draft` doesn't need it. Only two states — no "scheduled" or review-pending state, that's `GOV-07` |
| `CNT-04` | Slug handling and per-site uniqueness | D | 0.15 | 1 | CNT-01 | ⬜ todo |
| `CNT-05` | Page hierarchy: parent, depth limit, cycle guard | D | 0.20 | 1 | CNT-01 | ⬜ todo |
| `CNT-06` | Denormalised path and recursive recomputation | D | 0.35 | 1 | CNT-05 | ⬜ todo |
| `CNT-07` | Next catch-all route, host resolution, render | D | 0.45 | 2 | FND-04, CNT-06, BLK-01 | 🟨 in progress — `/preview/[site]/[[...path]]` resolves a page by path and renders it per-tenant; host resolution still stubbed by the slug-based preview prefix, not done |
| `CNT-08` | ISR revalidation on publish, host-inclusive cache key | D | 0.45 | 2 | CNT-07, GOV-08a | ⬜ todo |
| `CNT-09` | Signed-token preview URLs | B | 0.20 | 2 | CNT-07 | ⬜ todo |
| `CNT-10` | Duplicate page | A | 0.15 | 2 | CNT-01 | ⬜ todo |
| `CNT-11` | Trash, restore, permanent delete | A | 0.25 | 2 | CNT-01 | 🟨 in progress — `DELETE /content/:slug` (hard delete, tenant-scoped) wired into the Pages list with a confirm prompt; no trash/restore, deleting is permanent; see `WORKLOG.md` 2026-09-25 |
| `CNT-12` | Pre-publish validation | B | 0.20 | 2 | CNT-03 | ⬜ todo |

### BLK — Blocks and editor  ·  3.80d  ·  web + admin

The centrepiece of the pitch and the least-compressible engineering work. Ship four blocks working before building the rest.

Canvas mechanics (`BLK-03`, `BLK-04`, `BLK-07`) build on **Puck** rather than a hand-rolled iframe/
portal — see `DECISIONS.md` D-013. Days below are carried over unchanged from the from-scratch
estimate; treat them as provisional until the recommended Puck spike (wire the Hero block through
Puck's config) validates the integration.

| ID | Ticket | Band | Days | Wk | Depends on | Status |
| -- | ------ | ---- | ---- | -- | ---------- | ------ |
| `BLK-01` | Block registry, renderer, six blocks, theme tokens | A | 0.60 | — | — | ✅ done |
| `BLK-02` | Remaining render blocks: gallery, embed, FAQ | A | 0.40 | 2 | BLK-01 | 🟨 in progress — gallery + FAQ done, plus 5 blocks beyond original scope (logoCloud, stats, spacer, pricingTable, teamGrid); embed intentionally not built, see `WORKLOG.md` 2026-09-25 |
| `BLK-03` | Editor canvas (Puck): add, delete, reorder, duplicate | C | 1.00 | 2 | XRP-01, CNT-02 | 🟨 in progress — canvas built with all 14 real blocks, now wired to a real content record via `CNT-02`; add/delete/reorder/duplicate themselves still not interactively tested (drag/click unverifiable headlessly) |
| `BLK-04` | Per-block settings panel (Puck fields config) | C | 0.60 | 3 | BLK-03 | 🟨 in progress — fields defined for all 14 blocks, not interactively tested (drag/click unverifiable headlessly) |
| `BLK-05` | TipTap integration and sanitisation on write | B | 0.40 | 3 | BLK-04 | ⬜ todo |
| `BLK-06` | Form block, submissions table, admin list | B | 0.50 | 3 | BLK-04, FND-02 | 🟨 in progress — `ContactForm` block built (non-functional, no submit endpoint); submissions table and admin list still todo |
| `BLK-07` | Inline editing: Editable primitive + TipTap in canvas | C | 0.30 | 3 | XRP-01, BLK-04 | ⬜ todo |

### TYP — Content types and templates  ·  1.70d  ·  api + admin + web

The differentiating claim: an admin creates a content type live on screen and it routes with no deploy. Highest-compression work in the project.

| ID | Ticket | Band | Days | Wk | Depends on | Status |
| -- | ------ | ---- | ---- | -- | ---------- | ------ |
| `TYP-01` | Type builder UI | A | 0.40 | 3 | CNT-02 | ⬜ todo |
| `TYP-02` | Six field kinds, dynamic forms, JSONB, Zod | A | 0.60 | 3 | TYP-01 | ⬜ todo |
| `TYP-03` | Type-driven routing | B | 0.20 | 3 | TYP-01, CNT-07 | ⬜ todo |
| `TYP-04` | Template selection on create | B | 0.20 | 3 | TYP-05 | ⬜ todo |
| `TYP-05` | Four seeded starter block arrangements | A | 0.30 | 2 | BLK-02 | ⬜ todo |

### MED — Media  ·  0.70d  ·  api + admin

Local disk, sharp thumbnails. No S3, no CDN — one box, one volume is sufficient at demo scale.

| ID | Ticket | Band | Days | Wk | Depends on | Status |
| -- | ------ | ---- | ---- | -- | ---------- | ------ |
| `MED-01` | Upload, thumbnails, local disk | B | 0.30 | 3 | FND-02 | 🟨 in progress — `POST /media` uploads a file to site-scoped local disk, served back at `/uploads/:siteId/:file`; wired directly into every image field in the block editor (`ImageUploadField.tsx`), not just a standalone endpoint. No thumbnails (`sharp`) yet — the original upload is what gets stored and served; see `WORKLOG.md` 2026-09-28 |
| `MED-02` | Library grid, reuse, replace, delete, metadata | B | 0.25 | 3 | MED-01 | 🟨 in progress — `/media` page: grid of a site's uploads (backed by a real `Media` table, D-026), detail panel with metadata + Copy URL, Delete. Reuse now covered by `MED-03`'s picker; still no "replace in place" (delete + re-upload is the only path to swap a file) |
| `MED-03` | Media picker in block settings | B | 0.15 | 3 | MED-02, BLK-04 | ✅ done — `ImageUploadField` gained a "Browse" button opening `MediaLibraryModal.tsx`, a grid over the site's images-only media; picking one fills the field. No new API surface, reads the same `GET /media` list; see `DECISIONS.md` D-027, `WORKLOG.md` 2026-09-28 |

### SEO — SEO surface  ·  0.40d  ·  web + api

The reason the public site is server-rendered at all. Page source will be inspected during the pitch.

| ID | Ticket | Band | Days | Wk | Depends on | Status |
| -- | ------ | ---- | ---- | -- | ---------- | ------ |
| `SEO-01` | SEO fields, meta rendering, Open Graph | A | 0.20 | 4 | CNT-07 | ⬜ todo |
| `SEO-02` | Per-tenant sitemap.xml and robots.txt | A | 0.20 | 4 | CNT-07 | ⬜ todo |

### TAX — Taxonomy  ·  0.40d  ·  api + web + admin

An organisation feature, not an SEO feature. Archives ship noindex by default, as WordPress does, because thin tag pages are a liability.

| ID | Ticket | Band | Days | Wk | Depends on | Status |
| -- | ------ | ---- | ---- | -- | ---------- | ------ |
| `TAX-01` | Categories and tags, opt-in per type | A | 0.20 | 4 | TYP-01 | ⬜ todo |
| `TAX-02` | Archive and category listing pages | A | 0.20 | 4 | TAX-01, CNT-07 | ⬜ todo |

### GOV — Governance, workflow, navigation  ·  4.10d  ·  all three

What makes it read as a real product rather than a page editor: roles, review, history, menus — and the second tenant that proves the platform claim.

| ID | Ticket | Band | Days | Wk | Depends on | Status |
| -- | ------ | ---- | ---- | -- | ---------- | ------ |
| `GOV-08a` | Minimal second tenant and host mapping | B | 0.15 | 2 | FND-04, FND-06 | ⬜ todo |
| `GOV-01` | Revisions: snapshot, list, restore | A | 0.30 | 4 | CNT-01 | ⬜ todo |
| `GOV-02` | Revision comparison, block level | C | 0.50 | 4 | GOV-01, BLK-04 | ⬜ todo |
| `GOV-03` | Nested menu builder | C | 0.90 | 4 | CNT-01 | ⬜ todo |
| `GOV-04` | Header and footer content and branding | A | 0.20 | 4 | BLK-01 | ⬜ todo |
| `GOV-05` | Redirect engine and auto-redirect on slug change | B | 0.40 | 4 | CNT-04 | ⬜ todo |
| `GOV-06` | Roles as data, five seeded, site members | B | 0.55 | 4 | FND-05 | ✅ done — 5 fixed roles (`Role` enum), permission sets hardcoded and enforced via `PermissionsGuard` in the API, not just hidden UI; also built a team-invite flow beyond this ticket's literal scope (one-time links, no email infra exists) since "site members" needed a real way to get people in, not just the seed script (D-014's flagged gap) — see `DECISIONS.md` D-023. No per-author content ownership (Author/Contributor are permission tiers only, not content-scoped) |
| `GOV-07` | Submit for review and reviewer queue | B | 0.40 | 5 | CNT-03, GOV-06 | ⬜ todo |
| `GOV-08b` | Second tenant branding, content, cross-tenant bug hunt | D | 0.70 | 5 | GOV-08a, GOV-04 | ⬜ todo |

### DEP — Deploy and demo prep  ·  3.85d  ·  infrastructure

The least-compressible work in the project at 23% of remaining effort. The agent cannot see your server, wait for DNS, or judge whether demo copy is convincing.

| ID | Ticket | Band | Days | Wk | Depends on | Status |
| -- | ------ | ---- | ---- | -- | ---------- | ------ |
| `DEP-01a` | Skeleton deploy: EC2, nginx, wildcard TLS, pm2 | E | 0.40 | 1 | DEC-2 | ⬜ todo |
| `DEP-01b` | Deploy script, three-app topology, rollback | E | 0.80 | 5 | DEP-01a | ⬜ todo |
| `DEP-02` | Domains screen, UI only | A | 0.15 | 5 | GOV-06 | ⬜ todo |
| `DEP-03` | Realistic seed content for both tenants | E | 0.80 | 5 | GOV-08b, DEC-3 | ⬜ todo |
| `DEP-04` | Bug fixing and demo rehearsal | D | 1.70 | 5 | DEP-03 | ⬜ todo |

## Out of scope

Refuse list. Each is expensive to build and produces no visible difference in the demo. An addition
is re-estimated, not absorbed.

- **Global / reusable blocks** — the feature is propagation, not the block: reference tracking,
  cascade invalidation per page per tenant, impact preview.
- **User-definable blocks** — a second schema builder, and it breaks the one-component-shared
  property that makes preview exact.
- **Search** — per-tenant indexing to search roughly eight seeded pages.
- **Internationalisation** — roughly doubles the content model. The one exclusion that is
  structurally expensive to retrofit; decide deliberately, not by accident.
- **Plugin architecture / marketplace** — extensibility comes from the content-type builder and the
  block registry.
- **Cross-type references** — cascade rules, picker UI, orphan handling.
- **Per-page layout picker, related posts** — neither is on the demo path.
- **S3 / CDN** — one box, one volume, local disk.
- **Custom-domain TLS automation** — certbot, DNS verification, nginx regeneration. The Domains
  screen is present; the automation is deferred.

