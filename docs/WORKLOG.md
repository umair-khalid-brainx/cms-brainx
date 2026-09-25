# Worklog

Rolling status, **newest entry at top**. One entry per feature or meaningful chunk: what changed,
where, how it was verified, what is not done. Absolute dates only.

---

## 2026-09-24 — Critical doc pass: fixed a stale gotcha, recorded the business-model decision

**What changed**
- Removed the leftover dnd-kit-in-iframe gotcha from `admin/CLAUDE.md` — it described the
  hand-rolled canvas D-013 already replaced with Puck, and was left un-updated in that edit.
- Recorded `DECISIONS.md` D-014: `admin` is confirmed as self-serve for client companies
  themselves (not agency staff acting on their behalf), `web` is their customers' view. A
  platform-operator panel is explicitly deferred, not refused. Updated `CLAUDE.md`'s "What this
  is" section to state this plainly.
- Left two items unresolved on request: D-012's "single-owner" framing (owner said ignore for
  now — `EXECUTION_PLAN.md`'s Open Decisions table lists both "Saad" and "CEO" as separate people,
  so that line may still be inaccurate) and the still-untracked registration/roles/super-admin gap
  (`GOV-06` has no named roles, no invite flow, no tenant-provisioning UI).

**Not done** — no code changed. DEC-3 (demo tenant identities) and the Week 1 schedule-slip question
raised in the same review are still open, not addressed in this pass.

---

## 2026-09-24 — Editor canvas: adopt Puck, reject Gutenberg

**What changed**
- Evaluated Puck (`puckeditor/puck`, MIT) and Gutenberg (`@wordpress/block-editor`, GPL-2.0-or-later)
  as alternatives to hand-rolling the editor canvas (`BLK-03`/`BLK-04`/`BLK-07`). Chose Puck.
  Gutenberg rejected on licensing risk, a data-model conflict with the `content.blocks` JSONB
  contract, and two of its main strengths (nested blocks, large core block library) not applying
  given the fixed, code-defined block palette (invariant 8). Recorded as `DECISIONS.md` D-013
  (extends D-008, does not supersede it).
- Updated `BLK-03`/`BLK-04` ticket text in `EXECUTION_PLAN.md` to reference Puck; day estimates left
  unchanged and marked provisional. Updated `ARCHITECTURE.md`'s editor-canvas section and
  `admin/CLAUDE.md` invariant 2 to describe Puck's iframe mechanism instead of a hand-rolled
  `createPortal` mount.

**Verified** — licensing and data-model claims checked against Puck's and Gutenberg's own docs (MIT
license, `ComponentData` shape, GPL-2.0-or-later, HTML-comment serialization). The integration itself
— wiring an existing block component through Puck's `config.components` — has **not** been hands-on
tested.

**Not done** — no code written. Recommended next step is a spike: wire the Hero block through Puck
before `BLK-03` starts, to validate the integration before day estimates are re-baselined.

---

## 2026-09-24 — Repos folded into one; folders renamed to match README; docs moved to `docs/`

**What changed**
- Renamed `cms-nestjs` → `api`, `cms-nextjs` → `web`, `cms-reactjs` → `admin` to match the names
  `README.md` and `CLAUDE.md` already used.
- Moved `ARCHITECTURE.md`, `DECISIONS.md`, `WORKLOG.md`, `BACKLOG.md`, `EXECUTION_PLAN.md` and
  `README.md` into `docs/`; `CLAUDE.md` stays at the `CMS/` root so Claude Code still auto-loads it.
- Removed the three per-repo `.git` directories (each held a single trivial commit) and `git init`
  at the `CMS/` root instead. Added a root `.gitignore` for OS/editor files only — each project's
  own `.gitignore` still governs its `node_modules`, build output and `.env` files. First commit
  made at root. See `DECISIONS.md` D-012 (supersedes D-001).

**Verified** — `git status --short` was clean in all three repos before their `.git` dirs were
removed (nothing uncommitted lost); staged diff checked for `node_modules`/`.env` before committing.

**Not done** — no code changed in this entry.

---

## 2026-08-31 — Documentation system created; DEC-1 resolved

**What changed**
- Created `CLAUDE.md` (root) and `docs/` with `ARCHITECTURE.md`, `DECISIONS.md`, `WORKLOG.md`,
  `BACKLOG.md`, `EXECUTION_PLAN.md`. Added a thin `CLAUDE.md` to each of the three repos.
- Resolved the open editor-architecture decision (DEC-1) → `DECISIONS.md` D-008: shared
  `cms-blocks` package plus a same-origin `about:blank` iframe canvas. Tailwind adopted in `admin`
  as well as `web` (D-010).
- Re-baselined the plan for that decision (D-009): `XRP-01` 0.40 → 0.55d, `BLK-03` 0.90 → 1.00d,
  new `BLK-07` (inline editing) 0.30d. Remaining raw 18.95 → **19.50d** (+0.55, not the +0.45 first
  stated — arithmetic corrected same day); commitment unchanged at 25 working days, contingency
  inside it now 28% rather than 30%.

**Verified** — doc claims checked against the code as written: invariant greps run, ports and env
keys read from the actual files, `@nestjs/config` and Prisma versions read from `package.json`.

**Not done** — the docs are unversioned because `CMS/` is not a git repository (tracked in
`BACKLOG.md`). No code was written in this entry.

**Branch** — all three repos on `master`, zero commits.

---

## 2026-08-31 — Execution plan produced

**What changed** — converted the scope document into 52 tickets across ten epics, with bands,
estimates, dependencies and acceptance criteria; five weekly gates; a risk register mapping each
risk to the ticket that answers it. Published as an artifact and tracked in `EXECUTION_PLAN.md`.

**Verified** — epic sums and weekly loads reconcile to the same total (18.95d at the time).

**Not done** — decisions DEC-2 through DEC-5 still open.

---

## 2026-08-28 — Block renderer and theme-token system (`web`) — ticket BLK-01

**What changed**
- `web/src/blocks/`: `types.ts` (Block union, 6 types), `registry.ts` (exhaustive typed registry),
  `BlockRenderer.tsx`, `ui.tsx` primitives, and 6 components — Hero, RichText, ImageText,
  FeatureGrid, Testimonial, Cta.
- `web/src/theme/`: `SiteTheme` type, token flattening to `--site-*`, `SiteThemeRoot` wrapper.
- `web/src/site/`: header and footer driven by site settings; `SiteChrome` composition.
- `web/src/fixtures/`: two demo tenants (Corrick Oyster Co., Kestrel Rigging) with real copy.
- `web/public/media/`: four hand-written SVGs, so no binary assets and no remote image hosts.
- Routes: `/preview/[site]` per tenant (prerendered), `/` two-tenant comparison with theme swap.

**Verified** — `lint`, `typecheck` and `build` pass; both preview routes prerender with per-tenant
`<title>`; screenshotted in headless Chrome at 390 / 768 / 1440 with no horizontal overflow; the
colour-agnostic invariant grep returns nothing.

**Not done** — gallery, embed, FAQ and form blocks (`BLK-02`, `BLK-06`); everything editor-side;
the components have not yet been extracted into `cms-blocks` (`XRP-01`).

---

## 2026-08-28 — Restructured to three independent repositories

**What changed** — removed the root workspace (`package.json`, lockfile, hoisted `node_modules`,
`packages/`); moved `apps/{web,admin,api}` to `{web,admin,api}` at the container root; renamed
packages to `cms-web` / `cms-admin` / `cms-api`; gave each repo its own `.gitignore`, `.nvmrc`,
`.editorconfig`, `.env.example`, README and `git init`; moved `docker-compose.yml` into `api/`.

**Verified** — each repo installs, lints, typechecks, builds and tests standalone; all three run
simultaneously; API `/health` reports `database: up`; CORS confirmed for admin's origin.

**Not done** — no commits in any repo. Shared-code path between `web` and `admin` removed, which
D-008 addresses.

---

## 2026-08-28 — Initial scaffold

**What changed** — scaffolded Next.js 16 (`web`), Vite + React 19 (`admin`), NestJS 12 + Prisma 7
(`api`); Prisma module with `PrismaPg` adapter, `/health` endpoint, `ConfigModule`, CORS; created
the `cms` database on the local Homebrew Postgres.

**Verified** — all three built and ran; `/health` returned `database: up`.

**Superseded** — the npm-workspaces monorepo layout was replaced the same day (D-001).
