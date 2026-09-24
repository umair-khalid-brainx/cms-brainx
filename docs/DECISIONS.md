# Decision log

Why non-obvious choices were made, so they are not re-litigated. **Append only.** Never edit or
delete a past entry; if a decision changes, add a new dated entry and state which one it supersedes.

Entries D-001 to D-007 were recorded retroactively on 2026-08-31, when this log was created. The
decisions themselves were made on the dates shown.

---

## D-012 — 2026-09-24 — One git repository for api/web/admin, not three

**Decision:** `api`, `web` and `admin` now live under a single git repository at the `CMS/` root,
alongside `docs/`. Each keeps its own `package.json`, `node_modules` and `.gitignore`; no npm
workspaces, no hoisting, no shared root config. They still communicate only over REST — this
changes version control only, not the runtime or build architecture.

**Supersedes:** D-001 (three independent repositories). Also resolves `BACKLOG.md` B-01 (docs were
unversioned because the container had no repo of its own) and B-04 (nothing was committed).

**Why:** owner's call — the doc-versioning gap in D-011 (`CMS/` not being a git repo) and the
overhead of three CI pipelines / three places to commit outweighed the isolation benefit for a
single-owner proof-of-concept. The REST-only boundary between services was the part of D-001 worth
keeping; the separate-repos part was not.

**Cost accepted:** the three prior repos each had exactly one trivial commit (`done`, `oh my yes`,
similar) with no other branches or uncommitted work, so that history was discarded rather than
merged — starting from one clean initial commit was judged not to lose anything real. Going forward,
a change spanning `api` + `web`/`admin` lands in one commit instead of two coordinated ones, and
there is no `.gitignore` at the root controlling anything beyond OS/editor files — each subfolder's
own `.gitignore` still governs its `node_modules`/build output/`.env` as before.

---

## D-011 — 2026-08-31 — Documentation lives at the container root, not in a repo

**Decision:** `CLAUDE.md` and `docs/` live at `CMS/` (the folder containing the three repos). Each
repo gets a thin `CLAUDE.md` covering only its own concerns and linking up here.

**Why:** the docs describe the platform, which no single repo owns. Duplicating them in three repos
guarantees drift; putting them in one repo makes that repo arbitrarily special. `CMS/` is the working
directory, so a root `CLAUDE.md` is auto-loaded regardless of which repo is being worked on.

**Cost accepted:** `CMS/` is not a git repository, so these docs are currently **unversioned**.
Tracked as an open item in `BACKLOG.md` — the options are making `CMS/` a docs-only repo that
ignores the three project folders, or a separate `cms-docs` repo.

---

## D-010 — 2026-08-31 — Tailwind in both `web` and `admin`

**Decision:** `admin` adopts Tailwind 4 (`@tailwindcss/vite`) to match `web`.

**Why:** the shared block components are styled with Tailwind utility classes. With Tailwind in both
consumers, `cms-blocks` can ship readable source and each app generates the CSS it needs. The
alternative — shipping a prebuilt stylesheet from the package — adds a build step and makes the
package's CSS harder to override per tenant.

**Cost accepted:** admin's existing hand-written CSS is replaced; both repos must declare
`@source "../../node_modules/cms-blocks/src";` because Tailwind 4 does not scan `node_modules`.

---

## D-009 — 2026-08-31 — Plan re-baselined against delivered work and the repo split

**Decision:** remaining raw estimate is **19.50 engineer-days**; the commitment stays at **25 working
days**, leaving 5.50 days of slack inside it (28% contingency, down from 30%). Two sequencing changes: `DEP-01a` (skeleton deploy) moves into week 1, and `GOV-08` splits so
a minimal second tenant is seeded in week 2 rather than week 5.

**Why:** 0.85d of work was delivered (scaffold, block renderer) and the three-repo split created
0.70d that was never estimated (shared package, CI in three repos); D-008 added a further 0.45d.
The moves answer two risks that previously had no ticket against them: deployment is the least
compressible work and sat at the end, and the ISR host-cache-key bug is invisible with one tenant.

**Supersedes:** the phase totals in Scope Revision 2 §6. The banding model and per-task estimates
are unchanged.

---

## D-008 — 2026-08-31 — Shared `cms-blocks` package plus a same-origin iframe canvas

**Decision:** block types, registry, components, UI primitives and the theme system move into a
published `cms-blocks` package consumed by both `web` and `admin`. The editor canvas is an
`about:blank` **same-origin** iframe with the real block components mounted into it via
`createPortal`.

**Why:** the scope doc treats one component per block serving both the canvas and the live page as
*"the primary reason for accepting three processes rather than two"* — the preview is the same
component tree, not an approximation. Splitting into three repos removed the import path that made
this free, so the property has to be bought back deliberately. Separately, the iframe solves two
problems a plain div cannot: admin's own CSS would otherwise style the tenant's blocks, and `@media`
queries in a plain div measure the browser window rather than the canvas, making responsive preview
structurally wrong.

**Alternatives rejected:**
- *Duplicate the components in both repos* — zero setup, but drift is silent because each repo
  typechecks against its own copy. Adding a prop to a block would leave admin's generated settings
  panel without a field for it and nothing would error. This voids the exact-preview claim.
- *Git submodule or subtree* — shares source without publishing, but no version resolution,
  detached HEADs, recursive clones in CI.
- *Cross-origin iframe loading the real tenant site* (the WordPress Customizer model) — no
  JavaScript access across origins, so no inline editing and no click-to-select; and the iframe
  would contain finished HTML output rather than editable block data.
- *Return to a monorepo* — would make the problem vanish, but the three-repo split is a settled
  decision (D-001).

**Cost accepted:** version bump / publish / consume friction on every block change; `react` and
`react-dom` must be peer dependencies or local linking produces two React copies and
`Invalid hook call`; the deploy needs credentials for a private package (a git tag URL avoids a
registry); dragging blocks *inside* the canvas requires pointing dnd-kit's sensors at the iframe's
document.

**Implementation note:** extract the package **before** the editor is built. Retrofitting an
extraction under a half-built canvas is where the estimate goes wrong. Build the canvas in a plain
div first, get add/select/edit/reorder working, then move that same tree into the iframe.

**Reference:** WordPress's block editor is the same architecture — one block registry plus an iframed
canvas (the post editor canvas became iframed in WordPress 6.3).

---

## D-007 — 2026-08-28 — Dev preview route until host resolution exists

**Decision:** `web` serves `/preview/[site]`, looking a tenant up by slug from a fixtures map, and
`/` renders a two-tenant comparison view with a theme-swap control.

**Why:** block and theme work needed to proceed before the database and host resolution existed.
The comparison view also keeps the theme contract honest: if a block hardcodes a colour, swapping
the two themes exposes it immediately.

**Cost accepted:** two routes that will be deleted once the real catch-all route lands. `/` is a
client component so the swap button works; the tenant pages themselves stay server components.

---

## D-006 — 2026-08-28 — Block registry typed as exhaustive over the block union

**Decision:** `Registry = { [T in BlockType]: BlockDefinition<T> }`.

**Why:** a block type added to the union without a component becomes a compile error rather than a
silently blank section on a published page. Matters more when an agent is adding blocks.

---

## D-005 — 2026-08-28 — Blocks may reference only `--site-*` CSS variables

**Decision:** no block component carries a colour, typeface, radius or spacing literal. Everything
comes from `--site-*` custom properties set by a per-site theme wrapper.

**Why:** this is what makes multi-tenant theming real rather than aspirational — the same components
must produce visibly different brands from `theme_json` alone. It is also enforceable in review by
grep rather than by judgement.

**Cost accepted:** slightly noisier class names (`bg-[var(--site-paper)]`), and Tailwind's `@theme`
indirection cannot be used for these tokens because custom-property substitution resolves at the
`:root` where it is declared, not at the point of use.

---

## D-004 — 2026-08-28 — Prisma 7 with the `PrismaPg` driver adapter

**Decision:** `PrismaService` constructs `new PrismaPg({ connectionString })` and passes it as
`adapter`. Config in `api/prisma7.config.ts`, which imports `dotenv/config`.

**Why:** Prisma 7 ships no bundled query engine — a driver adapter is required, and instantiating
`PrismaClient` without one throws at boot. Prisma also no longer reads `.env` automatically.

**Cost accepted:** the generated client is TypeScript under `api/src/generated/prisma`, gitignored
and regenerated by `postinstall`, so a fresh clone will not typecheck until `npm install` has run.

---

## D-003 — 2026-08-28 — API runs on port 4001 locally

**Decision:** canonical port stays 4000 in `.env.example` and in the architecture; `api/.env`
overrides `API_PORT=4001`, and web/admin env files point at 4001.

**Why:** port 4000 on this machine is held by Local (the WordPress tool). Machine-specific overrides
belong in gitignored env files, not in the committed default.

---

## D-002 — 2026-08-28 — Local Homebrew Postgres instead of Docker Compose

**Decision:** develop against the Homebrew Postgres already running on `:5432`, with a `cms`
database created for this project. `api/docker-compose.yml` is kept as an alternative and maps host
port **5433**.

**Why:** Docker is not installed on this machine, and 5432 is already occupied, so a compose file
mapping 5432 would have clashed even if it were.

---

## D-001 — 2026-08-28 — Three independent repositories, not a monorepo

**Decision:** `api`, `web` and `admin` are separate git repositories with separate `node_modules`.
No workspace, no hoisting, no shared root config.

**Why:** owner's decision — the three projects are to stay isolated and communicate only over REST.

**Supersedes:** the initial npm-workspaces monorepo scaffold built the same day.

**Cost accepted:** ~1.05 GB of dependencies across three trees instead of 945 MB hoisted; three CI
pipelines instead of one; per-repo duplication of editor and lint config; and the loss of the import
path between `web` and `admin`, which is what D-008 exists to address.
