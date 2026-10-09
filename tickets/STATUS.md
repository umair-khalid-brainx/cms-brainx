# Ticket status

Single source of truth for ticket status (D-033). Order is build order: each ticket only
depends on tickets above it, except where a ticket was built early (its row says so).
Status values: TODO, IN-PROGRESS, DONE, BLOCKED, plus BACKLOG (not scheduled; `/build` skips it).
Estimates, weeks and gates stay in `docs/EXECUTION_PLAN.md`.

**Totals:** BACKLOG 1, DONE 20, IN-PROGRESS 6, TODO 27 (54 tickets). Updated 2026-10-07.

## M1 (week 1)

| Ticket | Title | Status | Tries | Note |
|---|---|---|---|---|
| FND-01 | Database schema and initial migration | DONE | 0 |  |
| FND-02 | Scoped repository layer | DONE | 0 |  |
| FND-05 | Auth: JWT, login, guards, role decorators | DONE | 0 |  |
| FND-06 | Seed: first tenant and admin user | DONE | 0 |  |
| XRP-01 | Shared block package | DONE | 0 |  |
| BLK-01 | Block registry, renderer, six blocks, theme tokens | DONE | 0 |  |
| CNT-01 | Content CRUD API, tenant-scoped | DONE | 0 |  |
| CNT-02 | Admin content list and edit screens | DONE | 0 |  |
| CNT-03 | Publish states and transitions | DONE | 0 |  |
| FND-03 | Tenant invariant tests | TODO | 0 |  |
| FND-04 | Host to site resolution with cache | DONE | 0 |  |
| XRP-02 | CI pipeline per repository | TODO | 0 |  |
| CNT-04 | Slug handling and per-site uniqueness | TODO | 0 |  |
| CNT-05 | Page hierarchy: parent, depth limit, cycle guard | TODO | 0 |  |
| CNT-06 | Denormalised path and recursive recomputation | TODO | 0 |  |
| DEP-01a | Skeleton deploy: EC2, nginx, wildcard TLS, pm2 | TODO | 0 | Blocked on DEC-2 (domain) |

## M2 (week 2)

| Ticket | Title | Status | Tries | Note |
|---|---|---|---|---|
| GOV-08a | Minimal second tenant and host mapping | DONE | 0 |  |
| CNT-07 | Next catch-all route, host resolution, render | DONE | 0 | Built before CNT-06; nested paths untested |
| CNT-08 | ISR revalidation on publish, host-inclusive cache key | DONE | 0 |  |
| CNT-09 | Preview links (stored token, revocable) | DONE | 0 |  |
| CNT-10 | Duplicate page | DONE | 0 |  |
| CNT-11 | Trash, restore, permanent delete | DONE | 0 |  |
| CNT-12 | Pre-publish validation | DONE | 0 |  |
| BLK-02 | Remaining render blocks: gallery, embed, FAQ | DONE | 0 |  |
| BLK-03 | Editor canvas (Puck): add, delete, reorder, duplicate | IN-PROGRESS | 0 | Tests pass; driven in real Chrome; user's own hands-on check pending |
| TYP-05 | Four seeded starter block arrangements | DONE | 0 |  |

## M3 (week 3)

| Ticket | Title | Status | Tries | Note |
|---|---|---|---|---|
| BLK-04 | Per-block settings panel (Puck fields config) | IN-PROGRESS | 0 | Labels done, checked in the in-app browser; needs a person to check by hand |
| BLK-05 | TipTap integration and sanitisation on write | TODO | 0 |  |
| BLK-06 | Form block, submissions table, admin list | IN-PROGRESS | 0 | Block renders; no submit endpoint or admin list |
| BLK-07 | Inline editing: Editable primitive + TipTap in canvas | TODO | 0 |  |
| TYP-01 | Type builder UI | TODO | 0 |  |
| TYP-02 | Six field kinds, dynamic forms, JSONB, Zod | TODO | 0 |  |
| TYP-03 | Type-driven routing | TODO | 0 |  |
| TYP-04 | Template selection on create | TODO | 0 |  |
| MED-01 | Upload, thumbnails, local disk | DONE | 0 |  |
| MED-02 | Library grid, reuse, replace, delete, metadata | DONE | 0 |  |
| MED-03 | Media picker in block settings | DONE | 0 |  |

## M4 (week 4)

| Ticket | Title | Status | Tries | Note |
|---|---|---|---|---|
| GOV-06 | Roles as data, five seeded, site members | DONE | 0 |  |
| SEO-01 | SEO fields, meta rendering, Open Graph | TODO | 0 |  |
| SEO-02 | Per-tenant sitemap.xml and robots.txt | TODO | 0 |  |
| TAX-01 | Categories and tags, opt-in per type | TODO | 0 |  |
| TAX-02 | Archive and category listing pages | TODO | 0 |  |
| GOV-01 | Revisions: snapshot, list, restore | TODO | 0 |  |
| GOV-02 | Revision comparison, block level | TODO | 0 |  |
| GOV-03 | Nested menu builder | TODO | 0 |  |
| GOV-04 | Header and footer content and branding | TODO | 0 |  |
| GOV-05 | Redirect engine and auto-redirect on slug change | TODO | 0 |  |

## M5 (week 5)

| Ticket | Title | Status | Tries | Note |
|---|---|---|---|---|
| GOV-07 | Submit for review and reviewer queue | TODO | 0 |  |
| GOV-08b | Second tenant branding, content, cross-tenant bug hunt | TODO | 0 |  |
| DEP-01b | Deploy script, three-app topology, rollback | TODO | 0 |  |
| DEP-02 | Domains screen, UI only | TODO | 0 |  |
| DEP-03 | Realistic seed content for both tenants | TODO | 0 |  |
| DEP-04 | Bug fixing and demo rehearsal | TODO | 0 |  |

## Backlog

| Ticket | Title | Status | Tries | Note |
|---|---|---|---|---|
| XRP-03 | Typed API client generated from OpenAPI | BACKLOG | 0 |  |
