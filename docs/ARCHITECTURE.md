# Architecture

How the system fits together. Update only when a structural invariant changes — a new component,
a changed data flow, a new integration. Decisions and their reasoning live in `DECISIONS.md`.

Last structural change: 2026-09-24 (editor canvas built on Puck instead of hand-rolled — D-013,
extends D-008).

## Topology

```
                          nginx :443
                               |
      +------------------------+------------------------+
      |                        |                        |
 *.<domain>            admin.<domain>            api.<domain>
      |                        |                        |
 cms-web (Next.js)     cms-admin (static)      cms-api (NestJS)
   SSR + ISR             React SPA build              |
   all tenant sites      admin + editor          Postgres :5432
      :3000                  :5173                   :4001

                      single EC2 instance, pm2
```

Local development runs the same three processes, started independently from each repo.
There is no root package.json and no workspace — each repo installs its own dependencies.

## What each component owns

**`cms-api`** — the only component with database access. Owns the schema, tenant scoping,
auth, publishing state, media files on local disk, and all validation. Exposes REST.

**`cms-web`** — renders public tenant sites. One catch-all route serves every tenant; the
tenant is resolved from the request host. Server-rendered because the SEO surface (meta titles,
canonical URLs, sitemaps, no-index) is only real if the server returns real HTML — a
client-rendered SPA would ship an empty div and make every SEO field decorative.

**`cms-admin`** — the authoring surface: content lists, the block editor, media library, site
settings. Static build behind `admin.<domain>`. No database access; REST only.

**`cms-blocks`** (planned, ticket XRP-01) — shared package holding block types, registry, block
components, shared UI primitives and the theme-token system. Consumed by both `cms-web` and
`cms-admin` so one component implementation serves the public page and the editor canvas.
Currently these files still live in `web/src/blocks/` and `web/src/theme/`.

## Multi-tenancy

**Storage** — shared tables with a `site_id` column, not a database per tenant. One migration
path, no provisioning code.

**Enforcement** — the repository layer. Every content method requires `siteId`; nothing outside a
repository touches Prisma. Tenancy is enforced by the shape of the API rather than by remembering
a `WHERE` clause, which matters more when an agent is writing the queries.

**Resolution** — request `Host` header → an in-memory host-to-site map, invalidated when a site
record changes. One catch-all route serves all tenants; there are no per-tenant route files or builds.

**Branding** — each site carries a `theme_json` blob: palette, type set, shape, density, texture.
Rendering flattens it to `--site-*` CSS custom properties on a wrapper element. Blocks read those
variables and nothing else, so a tenant can restyle every block without touching component code.

**Custom domains** — subdomain per tenant plus a wildcard certificate. A Domains screen shows DNS
instructions and pending status; the certbot/DNS-verification automation is deliberately out of scope.

## Content model

One `content` table with a `type` discriminator. Pages and posts share ~85% of their shape, so
they share one publishing pipeline, one revision system, one SEO implementation.

| Concern | Where it lives |
| ------- | -------------- |
| Block body | `content.blocks` JSONB — array of `{ type, ...props }`, shape defined by `cms-blocks/types.ts` |
| Custom field values | `content.data` JSONB — access pattern is fetch-by-(site, path) and render whole, so no EAV |
| Page hierarchy | `parent_id` tree, max depth 3, plus a denormalised `path` column so lookup is one indexed query |
| Non-page URLs | Prefix from the content type's config (`/blog/:slug`). Deliberately a separate mechanism from the page tree |
| Content types | Defined at runtime through the admin UI, over a fixed palette of 6 field kinds |

Type schema changes: adding a field is allowed; removing hides the field but retains the data;
renaming is unsupported. Documented limitation, not a migration engine — ACF and WordPress behave
the same way.

## Data flow: a visitor reads a page

```
GET https://corrick.<domain>/about
  → nginx routes by host to cms-web
  → cms-web resolves host → site (cached)
  → fetch content by (site_id, path) from cms-api
  → SiteThemeRoot applies theme_json as --site-* variables
  → BlockRenderer maps blocks[] through the registry to components
  → real HTML with real meta tags; result cached by ISR under a host-inclusive key
```

## Data flow: an author edits and publishes

```
1  Editor loads the page's blocks[] into Puck's data model (content: [{ type, props, id }])
2  Author adds / edits / reorders via Puck → the data payload changes
3  Puck's canvas re-renders in its same-origin iframe, with the real block
   components (style isolation + correct media queries)
4  Save → PATCH /content/:id { blocks } → api validates (Zod), writes JSONB,
   snapshots a revision
5  Publish → status = published → api triggers revalidation for that host + path
6  cms-web re-renders server-side from the database using the same components
```

The iframe is a mirror, not a pipe: nothing saves through it. Steps 4–6 are what update the
public site. See `DECISIONS.md` D-008 and D-013.

## Editor canvas

Built on **Puck** (MIT, see D-013), which provides its own same-origin iframe canvas rather than a
hand-rolled `about:blank` mount. Existing block components are registered as `config.components[type]
= { fields, render }`, where `render` is the same component `BlockRenderer` uses on the public site.
The iframe still exists for the same two reasons D-008 identified:

1. **Style isolation** — admin's reset, fonts and heading sizes cannot reach the tenant's blocks,
   and the tenant's theme cannot restyle admin's chrome.
2. **Correct responsive behaviour** — `@media` queries inside blocks measure the iframe, not the
   browser window, so a device-width toggle shows the layout a real device would get.

Inline editing works because the block components inside the iframe are our own React components
with our own handlers. Reordering, add/delete/duplicate and the settings panel are Puck's built-in
mechanics rather than hand-rolled drag/drop and portal code.

## Security model

| Concern | Approach |
| ------- | -------- |
| Authentication | Stateless JWT carrying user id and site memberships. No session store; revocation would need a denylist and is out of scope |
| Authorisation | 5 fixed roles (a Prisma enum, not a table — the permission set per role is hardcoded in `api/src/auth/permission.ts`, never edited at runtime; see D-023), checked in the API via `PermissionsGuard`/`@RequirePermission(...)`, not just hidden in the UI |
| Tenant isolation | Repository-layer scoping plus tests asserting tenant A cannot read tenant B |
| Rich text | Sanitised on write. Stored HTML is already safe; rendering does not sanitise |
| Media | Files on local disk scoped by site; a guessed URL must not cross tenants |
| Validation | Zod on write. `class-validator` is deliberately absent |

## Environments and configuration

Each repo owns its own env file; there is no shared config.

| Repo | File | Keys |
| ---- | ---- | ---- |
| `api` | `.env` | `DATABASE_URL`, `API_PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGINS` |
| `web` | `.env.local` | `NEXT_PUBLIC_API_URL`, `DEFAULT_TENANT_HOST` |
| `admin` | `.env.local` | `VITE_API_URL` |

`CORS_ORIGINS` must list web's and admin's origins — they are separate origins, so CORS is what
lets them call the API at all.

## Built vs not built

**Built:** three repos scaffolded and running; API health endpoint reporting database connectivity;
typed block registry, renderer, 6 block components, theme-token system, two demo tenant fixtures,
dev preview routes.

**Not built yet:** the entire database schema, tenant middleware and repository layer, auth, content
CRUD, publishing, the editor, custom content types, media, SEO surface, taxonomy, governance,
deployment. See `EXECUTION_PLAN.md` for the sequence.

Anything in this document describing the API or the database is **design, not code**, until the
corresponding ticket is marked done in `EXECUTION_PLAN.md`.
