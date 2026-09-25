# Decision log

Why non-obvious choices were made, so they are not re-litigated. **Append only.** Never edit or
delete a past entry; if a decision changes, add a new dated entry and state which one it supersedes.

Entries D-001 to D-007 were recorded retroactively on 2026-08-31, when this log was created. The
decisions themselves were made on the dates shown.

---

## D-024 — 2026-09-25 — A site's Owner is singular and permanent

**Decision:** Extends D-023. A site has exactly one Owner, assigned once at creation (the seed
script / whoever creates the site), and that never changes through the team-management routes:
`TeamService.updateMemberRole` refuses any change to a membership whose current role is `owner`
(409), and refuses to set any membership's role *to* `owner` (409) — so an Owner can't be demoted
and no one else can be promoted into it. `TeamService.createInvite` refuses `role: 'owner'` the same
way, so an invite can't mint a second Owner either. `assignableRoleSchema`
(`api/src/team/dto/membership.dto.ts`) — `administrator | editor | author | contributor`, no `owner`
— is the first line of defense at the Zod layer (plain 400 for a bad request body); the service-level
checks are a deliberate second layer, not redundant with the DTO, matching this codebase's existing
pattern of also checking `content:publish` in `ContentService` on top of the route guard. The existing
last-owner protection on `removeMember` (refuses to delete the sole Owner) already composed correctly
with this and needed no change — with promotion-to-owner blocked, owner count can now only ever be
exactly 1, so that check's `ownerCount <= 1` branch is always the one that fires.

**Admin UI matches, not just the API.** `admin/src/lib/roles.ts` adds `ASSIGNABLE_ROLES`/
`ASSIGNABLE_ROLE_OPTIONS` (excludes `owner`) for both the invite-role `<Select>` and the per-member
role `<Select>` in `TeamPage.tsx` — Owner is never offered as a choice, not just rejected after the
fact. The Owner's own row renders a static "Owner" label instead of a `<Select>`, and its Remove
button is disabled with a title explaining why — same "affordance only" spirit as
`admin/CLAUDE.md` invariant 3, since the API is what actually enforces this.

**Why permanent rather than transferable:** no "transfer ownership" flow was requested or built.
Making Owner immutable is the simpler, safer default for a POC — the alternative (a real transfer
flow: current Owner explicitly hands it to someone else, old Owner demoted in the same transaction)
is a real feature with its own UX and is not needed yet. Noted in `docs/BACKLOG.md` as a real gap,
not silently precluded.

**Verified for real**, restarting the dev API first since it wasn't running in watch mode and had
stale code (confirmed the hard way — an owner-role invite was accepted by the pre-restart process,
then cleaned up from the database before re-testing): invite with `role: 'owner'` → 400; PATCH the
Owner's own membership to `administrator` → 409 ("The owner's role cannot be changed"); PATCH a real
second member to `role: 'owner'` → 400; a legitimate role change (administrator → editor) on that
same member → 200; DELETE the Owner's membership → 409 (unchanged last-owner behavior). Admin UI
verified via CDP screenshot: Owner row shows a disabled "Owner" label and greyed-out Remove button;
the invite Role dropdown lists only Administrator/Editor/Author/Contributor.

---

## D-023 — 2026-09-25 — Real roles (`GOV-06`) and a team-invite flow, built together

**Decision:** `SiteMembership.role` becomes a Prisma `Role` enum (`owner`, `administrator`, `editor`,
`author`, `contributor`) instead of a free-text string, backed by a hand-fixed migration (Prisma
refused to auto-generate a cast for existing data — `role = 'owner'` on the seeded row — so the
`ALTER COLUMN` in `20260925130620_add_roles_and_invites` was rewritten by hand to
`USING ("role"::"member_role")` rather than the drop-and-recreate Prisma proposed). `ROLE_PERMISSIONS`
(`api/src/auth/permission.ts`) hardcodes each role's permission set; `PermissionsGuard` +
`@RequirePermission(...)` enforce it in the API — not just a hidden button in `admin`
(`admin/CLAUDE.md` invariant 3). A new `Invite` model and `TeamModule` let an owner/administrator
invite people by email + role; since no email-sending infrastructure exists anywhere in this repo,
accepting an invite works via a one-time link the inviter copies and shares manually, not an email.

**Enum, not a table — corrects this doc's own earlier wording.** `ARCHITECTURE.md`'s Security model
table and this ticket's `EXECUTION_PLAN.md` row both said "a `roles` table... five seeded." Built as
an enum instead: the 5 permission sets are hardcoded in code and never edited at runtime (no
permission-builder UI — the owner picks one of 5 fixed presets per member, matching root `CLAUDE.md`
invariant 8's "fixed palettes are deliberate"), so a table's only real payoff never applied. Both docs
corrected in this same change, per this repo's own rule: "if a doc contradicts the code, the code
wins — fix the doc in the same pass."

**Author/Contributor have no real content ownership.** Real WordPress restricts these roles to their
own posts; this app's `Content` table has no `authorId`, and Author/Contributor here differ from
Editor only by permission level (Contributor can't publish), not by whose page it is. Deliberate
simplification, not an oversight — flagged so the role names don't silently imply more than they
enforce.

**Invite tokens are SHA-256 hashed, not bcrypt** — a 256-bit random token has no keyspace to
brute-force, so bcrypt's deliberate slowness buys nothing, and a fast hash supports the O(1)
lookup-by-token bcrypt can't do without storing the raw token. **Accepting an invite for an email that
already has an account always requires that account's real password**, verified with `bcrypt.compare`
before anything happens — never trusts simply having the link, since a forwarded/leaked link
shouldn't let someone attach themselves to a stranger's account.

**Two real bugs, caught by testing the built thing, not by reading the code:**
1. `MembershipRepository`/`InviteRepository` were leaking `passwordHash` and `tokenHash` into API
   responses via `include: { user: true }` / a bare `findMany`. Fixed with explicit Prisma `select`s
   before this ever shipped anywhere.
2. `TeamController`'s class-level `@RequirePermission('members:manage')` silently enforced nothing —
   `Reflector.get(key, context.getHandler())` only reads metadata attached to the specific method, not
   inherited from a class-level decorator, so every authenticated user of any role could list and
   manage a site's team. Confirmed via a real request as a non-owner (200 instead of the expected
   403) before being traced to the guard and fixed with `getAllAndOverride([handler, class])`, then
   re-verified the same way.

**Verified, not assumed:** full loop over curl + `psql` — created an invite as owner, confirmed only
the hash (not the raw token) landed in Postgres, accepted it as a brand-new account, confirmed the
real session shape came back; separately invited an already-registered email on a second site,
confirmed a wrong password was rejected (401) and the right one attached a membership to the
*existing* user id rather than creating a duplicate. Then the same loop again through a real Chrome
tab over CDP driving the actual `admin` UI: sent an invite from `/team`, opened the generated link in
a fresh tab, accepted it, landed on `/dashboard` with a real session, watched the new member appear
in the owner's team list, changed their role and removed them via the real controls — each step
re-confirmed in Postgres, not just the UI's own state. All test data cleaned up afterward.

---

## D-022 — 2026-09-25 — `corrickPages.ts` deleted, exactly as D-017 said it would be; its parity checker goes with it

**Decision:** `admin/src/data/corrickPages.ts` deleted — D-017 explicitly named this file as something
that "gets deleted once `CNT-01`/`CNT-02` land and both sides fetch the same rows from `api` instead,"
and D-021 finished that: all 4 pages are real database rows now. `scripts/check-content-parity.mjs`
(D-019) is deleted with it — its entire job was catching drift between this file and `web/src/
fixtures/corrick.ts`; with one side of that pair gone, there is nothing left for it to compare. Its
`CLAUDE.md` "Root-level scripts" entry and `scripts/migrate-corrick-pages.mjs` (D-021's one-off
migration tool, whose only job was reading this file) are removed too — the migration ran once and
its source no longer exists, so it could never run again.

**What this doesn't resolve:** `web/src/fixtures/corrick.ts` is still hand-authored, standalone
fixture data — `web` doesn't read from the database at all yet (`CNT-07`/`CNT-08`, still open). There
is no guardrail today catching `web`'s fixture drifting from what `admin`/the database actually have.
That's a smaller, different problem than the one D-017/D-019 solved (two *duplicated* files, both
meant to represent the same content) — `web`'s fixture isn't a duplicate of anything anymore, it's
the only copy of "Corrick as a static demo," independent of the real CMS content, until `CNT-07`
wires `web` to `api` for real.

---

## D-021 — 2026-09-25 — `DELETE /content/:slug` added; all 4 `corrickPages.ts` demo pages migrated into the real database

**Decision:** `ContentRepository.delete`/`ContentService.remove`/`ContentController.remove` add
tenant-scoped hard delete (`204` on success, `404` if the slug doesn't exist on the caller's site).
`PagesListPage` gets a Delete action per row with a `window.confirm` prompt. This is a genuine hard
delete, not the trash/restore workflow `CNT-11` originally scoped — that's still open; deleting a page
today is permanent.

**Superseding D-020's "one page seeded" note:** all four of `admin/src/data/corrickPages.ts`'s demo
pages (Home, Visit the Farm, Wholesale, Harvest Log) are now real rows in `content`, migrated with a
one-off script (`scripts/migrate-corrick-pages.mjs` pattern, run once, not part of the app) that
called the real `/content` API — reusing the exact same Puck-data → flat-block translation logic as
`admin/src/lib/contentApi.ts`, not hand-copied field by field, so the migration itself is a real test
of that translation code across all 14 block types, including the `PricingTable` features-array
special case on the Wholesale page.

**`admin/src/data/corrickPages.ts` is now fully unused**, not just partially — nothing imports it
anymore. Left in place rather than deleted, same reasoning as D-020: worth a deliberate call, not
one made silently mid-task.

**Verified, not assumed:** confirmed all 4 pages and their block counts via `psql`, and spot-checked
the Wholesale page's `pricingTable` block to confirm `features` came through as `string[]` (the
contract shape), not Puck's `{text: string}[]` editing shape. Then, to prove delete is real and not
just a client-side list filter, drove it through a real Chrome tab over CDP: logged in, opened
`/pages`, clicked the real Delete button on "Harvest Log," auto-accepted the browser's confirm
dialog via CDP, and confirmed via `psql` the row was actually gone from Postgres — then restored it
with the same migration script so the repo's local database still has the full 4-page demo.

---

## D-020 — 2026-09-25 — `CNT-01`/`FND-02`: real content API replaces `localStorage`; `siteId` from the caller's first membership; D-015's translation finally implemented

**Decision:** `ContentRepository` (`FND-02`) wraps `PrismaService` for the `content` table, every method
requiring `siteId`. `ContentController`/`ContentService` (`CNT-01`) expose `GET/POST /content` and
`GET/PATCH /content/:slug` behind `JwtAuthGuard`. `admin`'s `pagesStore.ts` (the `localStorage` D-019
placeholder) is deleted; `PagesListPage`, `DashboardPage`'s Quick Draft, and `EditorPage` now read and
write this API through a new `admin/src/lib/contentApi.ts`.

**`siteId` comes from the caller's first `SiteMembership`, not a request parameter** (api invariant
5). `ContentService.resolveSiteId` looks up the authenticated user's memberships and takes the first.
Correct today because every seeded user has exactly one; a user with several isn't disambiguated —
that's a site switcher, `GOV-06`/`DEP-02` scope, not this ticket. Revisit this exact spot when that
lands.

**Slugging moved from `admin` to `api`.** `pagesStore.ts` used to slugify Quick Draft titles and
suffix collisions (`-2`, `-3`, ...) client-side. `ContentService.uniqueSlug` does the same job
server-side now — the natural home for it once a real API exists, and it means any future second
client (a CLI, another admin surface) gets correct slugs for free.

**D-015's translation is now actually written, not just planned.** `content.blocks` still stores the
flat `cms-blocks/types.ts` contract; `admin/src/lib/contentApi.ts` converts Puck's native
`{ type: 'Hero', props: { id, ...fields } }` to and from that flat shape at the API boundary — the
exact function D-015 said would need to exist, which didn't until now. `PricingTable`'s one field
mismatch (`features: {text}[]` in Puck vs `features: string[]` in the contract, per `puck/config.tsx`'s
own comment) is handled at the same boundary.

**One page seeded, not the four in `corrickPages.ts`.** The database starts with a single real "Home"
page (`prisma/seed.ts`), hand-written directly in the flat block contract — enough to prove the CRUD
loop end to end without building a one-off migration pipeline to translate all four of `admin/src/data/
corrickPages.ts`'s Puck-shaped demo pages into real rows. `web/src/fixtures/corrick.ts` is unaffected
(`web` doesn't touch the database; that's `CNT-07`/`CNT-08`).

**Cost accepted — `admin/src/data/corrickPages.ts` is now dead code.** Nothing imports it anymore
(`contentApi.ts` never reads it). Left in place rather than deleted, since it's the only surviving
record of the original 4-page demo content if someone wants to seed the rest later; worth a deliberate
delete-or-migrate call, not one made silently in this pass.

**Verified, not assumed:** driven through a real Chrome tab over CDP — logged in for real, watched
Dashboard's "At a Glance" read live counts from `GET /content`, submitted Quick Draft and confirmed a
real row landed in Postgres, saw it in the Pages list, clicked the real Hero block in the editor
canvas, edited its headline, waited past the autosave debounce, clicked Publish, then confirmed via
`psql` that the edited headline and `published` status were actually in the database — and opened a
**second, fresh** tab at the same editor URL and watched it render the edited headline back, proving
the read path (stored blocks &rarr; Puck data) round-trips too, not just the write path.

---

## D-019 — 2026-09-25 — Editor persistence lives in `localStorage`; a hand-rolled Publish button, not Puck's

**Decision:** `EditorPage.tsx` now autosaves — Puck's `onChange` writes the current page data to
`localStorage` (key `cms-admin.draft.<slug>`, 500ms debounced) via a new `admin/src/lib/
pagesStore.ts`. On load, a page's autosaved draft (if any) is overlaid on top of its seed data from
`corrickPages.ts`, so navigating away and back — or a full reload — no longer loses in-progress
edits. The Dashboard's Quick Draft is wired to the same store: submitting it calls `createDraftPage`,
which slugifies the title, wraps the body in a single `RichText` block, and appends a wholly new page
to a second key (`cms-admin.extra-pages`) — so it really does create a new page, not just decorate
the form.

**The Publish button is our own, not Puck's.** `<Puck onPublish={save} />` is Puck's own README
example, followed exactly — and it does not render a visible Publish button in the installed
`@puckeditor/core@0.23.0`. This was traced into their bundled source
(`node_modules/@puckeditor/core/dist/chunk-55V3NZVF.mjs`), not just observed as a missing DOM
element: `CustomHeaderActions` resolves to `overrides.headerActions || defaultHeaderActionsRender`,
`defaultHeaderActionsRender` returns `DefaultOverride` (`({children}) => <Fragment>{children}</Fragment>`,
i.e. a pass-through, not a suppressor), and the actual `<Button onClick={() => onPublish?.(data)}>`
JSX is present in that render tree with no permission or `menuOpen` gate found anywhere upstream of
it — the code path says the button should exist, and empirically (confirmed via `document.
querySelectorAll` for any element bearing its `lucide-globe` icon class or an aria-label containing
"Publish", across the whole rendered tree) it does not. Root cause not fully resolved — could be a
version-specific regression, an i18n `useMessage("header-publish")` resolving empty without a
`messages` config we don't provide, or something else entirely.

**Why build our own instead of chasing the root cause further:** a Publish action the user can
actually click matters more than which code renders the button, and the fix is small — one `<button>`
in our own `.editor-topbar`, backed by a ref that tracks the latest `onChange` data (`latestDataRef`)
so the click handler doesn't need access to Puck's internal store. `onPublish` stayed wired on
`<Puck>` too, calling the same save path, in case a future Puck version fixes whatever is suppressing
its own button — cheap forward-compatibility, not load-bearing.

**Verified, not assumed:** the whole loop was driven through a real, running Chrome tab over the
DevTools Protocol — clicked the actual rendered Hero block inside Puck's real (same-origin) canvas
iframe, edited its real `headline` field, waited past the debounce, confirmed the value in
`localStorage`, clicked the real Publish button, then opened a **fresh** tab at the same URL and
confirmed the edited headline is what renders — proving the save-and-reload round trip, not just that
a function got called.

**Cost accepted:** none of this is real persistence — it's `localStorage`, scoped to one browser, one
machine. `CNT-01`/`CNT-02` still replace this entirely; `pagesStore.ts` is a placeholder consistent
with `corrickPages.ts`'s existing role (D-015), not a permanent architecture.

---

## D-018 — 2026-09-25 — Real auth: JWT in `localStorage`, hand-rolled guard, no `@Roles` yet

**Decision:** `api` gets a real `AuthModule` — `POST /auth/login` (email/password against `bcryptjs`-
hashed `User.passwordHash`, returns a signed JWT + session), `GET /auth/me`, and a `JwtAuthGuard`
that verifies the `Authorization: Bearer` header directly via `@nestjs/jwt`'s `JwtService` — no
`passport`/`passport-jwt`. `admin`'s `LoginPage` calls it for real, stores `{accessToken, user,
memberships}` in `localStorage`, and a `RequireAuth` route wrapper redirects to `/login` when that's
absent.

**Why no passport:** one guard, one strategy. `@nestjs/jwt`'s `JwtService.verifyAsync` is the entire
mechanism passport-jwt would wrap; pulling in passport's strategy/session machinery for that is
weight without payoff at this scale.

**Why `localStorage`, not an httpOnly cookie:** simpler for a pure SPA with no server-rendered admin
pages to protect, and there's no XSS surface here beyond what Vite/React already control (`admin`
renders no user-supplied HTML). Revisit if `admin` ever renders untrusted content or needs
cross-subdomain auth with `web`.

**Cost accepted — no role enforcement yet:** `SiteMembership.role` is stored (seeded as `'owner'`)
and returned in the session, but nothing checks it. `RequireAuth` only proves *a* valid session
exists, matching `api/CLAUDE.md` invariant 3 — "permission checks in `admin` are UI affordance, not
enforcement" — which was already true before this and remains true now. `FND-05`'s "role decorators"
half is still open, tracked in `EXECUTION_PLAN.md`.

**Seed data:** `api/prisma/seed.ts` (`npm run db:seed`, manual — not `prisma migrate reset`'s seed
hook) creates one real `Site` (Corrick Oyster Co., `themeJson` matching the theme already duplicated
into `web`'s fixture and `admin`'s Puck config per D-017) and one real `User`/`SiteMembership`. This
is the first real row in every table `FND-01` defined — everything before this was fixtures.

---

## D-017 — 2026-09-25 — Multi-page fixtures; `admin`'s demo content is its own dataset, not shared

**Decision:** `SiteFixture.page: SitePage` became `SiteFixture.pages: SitePage[]` in `web`. The
temporary `/preview/[site]` route became `/preview/[site]/[[...path]]`, resolving a page by matching
`path` against the URL's remaining segments (`/` for home). `admin` gets a matching multi-page
surface — a `/pages` list and `/editor/:slug` — reading from a new local module,
`admin/src/data/corrickPages.ts`, written independently to match `web/src/fixtures/corrick.ts` in
content and voice, not imported from it.

**Why not share the content between repos:** `admin` cannot import from `web` — no cross-repo
imports except the published `cms-blocks` package (root `CLAUDE.md`), and fixture/page content isn't
part of that package; it's demo data standing in for rows in `content`, same reasoning as D-016's
`cms-blocks` extraction not covering content. The alternative — a second shared package just for
fixture data — was rejected as overbuilding for something that gets deleted once `CNT-01`/`CNT-02`
land and both sides fetch the same rows from `api` instead.

**No schema change needed:** `FND-01`'s `Content` model (`docs/WORKLOG.md` 2026-09-25) already has
`@@unique([siteId, path])` — it was multi-page-shaped from the start. This decision is the UI/fixture
layer catching up to a schema that already assumed it, not a new data-modelling choice.

**A real bug found doing this, not just described:** the temporary preview route's nav/footer links
needed a `/preview/corrick` prefix that fixture data (production-shaped: `/wholesale`, not
`/preview/corrick/wholesale`) doesn't have. First fix only prefixed `settings.nav`/`settings.footer`
— missed that block props (`Hero.secondaryAction`, `Cta.action`, ...) carry the same kind of
same-site links, scattered across all 14 block types. Caught by grepping the rendered page's actual
`href` attributes rather than assuming the nav-only fix was sufficient. Fixed with one generic
recursive walker (`prefixHrefs`) over the whole fixture rather than special-casing each block's link
fields — simpler and doesn't need updating every time a block gains a new link-shaped prop.

**Cost accepted:** Corrick's page content now exists in two places (`web`'s fixture, `admin`'s
dataset) that must be kept in sync by hand until `CNT-01` replaces both with real API calls. Marked
`CNT-02` and `CNT-07` in-progress with this caveat in `EXECUTION_PLAN.md` rather than done.

---

## D-016 — 2026-09-25 — `cms-blocks` extracted as a real local package (`XRP-01`), not published

**Decision:** the 6 block components, `types.ts`, `registry.ts`, `BlockRenderer.tsx`, `ui.tsx`, and
the theme system (`theme.ts`, `SiteThemeRoot.tsx`) moved out of `web/src/blocks/` and
`web/src/theme/` into a new package, `cms-blocks/`, at the `CMS/` root — a sibling to `api`/`web`/
`admin`, not nested inside any of them. `web` and `admin` both consume it via `"cms-blocks": "file:
../cms-blocks"` in `package.json` (npm creates a real symlink), not a private registry.

**Why now, not later:** building the real editor in `admin` required rendering actual block
components there, and invariant 3 forbids copying them into a second repo — this was a genuine
blocker, not a nice-to-have. D-008's implementation note already warned that retrofitting the
extraction under a half-built canvas is where estimates go wrong; doing it now, before `BLK-03`
proper, avoids that.

**Deviates from D-008's framing:** D-008 says "published `cms-blocks` package," implying an eventual
registry (npm, or a private one, per its own "cost accepted" list mentioning "credentials for a
private package"). This is a local `file:` dependency instead — no registry, no publish step, no
version resolution. Good enough for one machine / one repo; revisit if `cms-blocks` ever needs to be
consumed outside this repo (e.g. a separate deploy pipeline) or versioned independently.

**cms-blocks ships a compiled `dist/`, not raw source, despite Tailwind's own `@source` pointing at
`src/`.** These serve two different purposes and don't conflict: `@source` only needs literal class-
name strings on disk for Tailwind's scanner, which `src/` (TSX) provides more readably than compiled
JS would. But `package.json`'s `main`/`exports`/`types` point at `dist/` — raw `.ts` as the actual
resolution target failed in Next's production build (see the `web` gotcha below); a real `tsc` build
step avoided fighting that. `cms-blocks` needs `npm run build` after any change until this is
automated (out of scope for now — one more manual step, not a blocker at this scale).

**Cost accepted:** `admin` also picked up Tailwind 4 (`D-010`, decided 2026-08-31, not executed until
now) — the shared block components use Tailwind utility classes and render unstyled without it. Two
real, non-obvious bugs were hit and fixed getting this working (see `CLAUDE.md` gotchas): Turbopack
won't resolve a symlinked package whose real path is outside `turbopack.root`; the `@source` path
depends on the importing file's depth and cannot be copied verbatim between repos with different
folder structures.

---

## D-015 — 2026-09-25 — `content.blocks` stores the flat contract; Puck's native shape is translated at the boundary, not stored

**Decision:** `content.blocks` continues to store the flat `{ type, ...props }` shape already defined
by `cms-blocks/types.ts` (invariant 7), unchanged from before Puck was adopted. `admin` is
responsible for translating Puck's native `ComponentData` shape (`{ type, props: { id, ...fields } }`)
into that flat shape before it is ever sent to the API. The API never sees or stores Puck's wrapper.

**Why:** confirmed by the `/dev/puck-spike` spike (see `WORKLOG.md`, this date) that Puck's native
save shape is a nested `props` wrapper carrying its own `id`, which does not match the flat contract
`web`'s already-shipped `BlockRenderer` and all six `BLK-01` block components already expect.

**Alternative rejected: store Puck's native shape as-is.** Would require changing all six existing
block components (not just Hero) to read `block.props.x` instead of `block.x`, or push the same
translation to read-time inside `BlockRenderer` instead — paying the cost on every public page view
instead of once at save. Would also permanently store a Puck-internal `id` that means nothing to
`web`, weaken invariant 7 (two competing shapes instead of one contract), and couple the stored data
format to Puck's own internal versioning — a library `admin` depends on but `web` never imports,
which the three-repo split (D-001) was meant to keep decoupled.

**Cost accepted:** one small translation function at the `admin` → API boundary, which has to be kept
in sync if Puck's internal shape changes in a future version. Judged worth it to keep `content.blocks`
owned entirely by `cms-blocks/types.ts`, not by an upstream library's release cadence.

---

## D-014 — 2026-09-24 — `admin` is self-serve for client companies; super-admin panel deferred

**Decision:** `admin` is used directly by **client companies themselves** — a client's own staff log
in and build/manage their own site's pages. It is not an internal tool operated by us on clients'
behalf. `web` is what that client's own customers/visitors see. A platform-operator ("super-admin")
panel — for us to create new tenant sites, see all clients, manage billing/plans — is **explicitly
deferred**, not decided, not refused. This is distinct from the out-of-scope refuse-list in
`EXECUTION_PLAN.md`: refused items are decided-against, this one is simply not yet decided.

**Why:** owner's clarification. Matters structurally because it decides who ends up in the `roles`
table (`GOV-06`) — real external client users, not internal staff — and who the pitch demo's admin
experience is actually designed for.

**Cost accepted / open consequence:** `ARCHITECTURE.md` already notes "no provisioning code" for
creating a tenant site. With `admin` confirmed as client-facing rather than internal, the related gap
— no registration/invite flow for a client's own users, no named roles yet — is now a sharper
question than before: a real external client needs an actual way to get their first login, not just
a seed script. Still open, not yet turned into a ticket or a numbered decision.

---

## D-013 — 2026-09-24 — Editor canvas built on Puck, not hand-rolled; Gutenberg rejected

**Decision:** the editor canvas mechanics (drag/drop, selection, reorder, duplicate, settings panel)
are built on **Puck** (`puckeditor/puck`, MIT) rather than hand-rolled from a plain `createPortal`
iframe mount. Existing block components are wired in through Puck's `config.components[type] =
{ fields, render }`, where `render` is the same React component `BlockRenderer` already uses —
Puck's own iframe canvas mode replaces the custom same-origin `about:blank` iframe.

**Extends, does not supersede, D-008.** The underlying architecture — shared `cms-blocks` package,
same-origin iframe canvas for style isolation and correct `@media` measurement, one component
serving both the editor and the public page — is unchanged. This decision only changes *what builds
the canvas mechanics*, not the architecture D-008 settled.

**Alternative considered and rejected: Gutenberg (`@wordpress/block-editor`).** Evaluated because
D-008 already cites it as the architecture's reference point. Rejected for:
- **Licensing** — GPL-2.0-or-later; bundling it into a distributed commercial `admin` build risks
  obligating the combined work to be GPL-compatible. Unresolved without legal review, and resolving
  it isn't worth doing when a clean MIT alternative (Puck) covers the same need.
- **Data model conflict** — Gutenberg's canonical format is HTML with comment-delimited JSON
  attributes (`<!-- wp:hero {...} --></div>`), not a JSON array. Storing that, or translating it,
  breaks or duplicates the `content.blocks` JSONB contract (invariant 7 / `cms-blocks/types.ts`).
  Puck's data model (`{ content: [{ type, props, id }], root }`) maps onto that contract directly.
- **Save/render pipeline mismatch** — Gutenberg's `save()` typically emits static markup; keeping
  "one component renders both surfaces" would mean bypassing `save()` and re-driving render through
  the existing registry anyway, absorbing Gutenberg's registration complexity without using the part
  of it meant to save the work.
- **Unused strength, irrelevant strength** — nested `InnerBlocks` is Gutenberg's biggest edge and the
  current block list is flat; its larger core block library is inapplicable because invariant 8 fixes
  the palette to code-defined, colour-agnostic, shared components already.
- **Purpose fit** — adopting WordPress's own editor architecture wholesale sits oddly against
  `CLAUDE.md`'s framing that the architecture decisions, not code volume, are the deliverable.

**Why Puck:** MIT-licensed (no licensing question), data model matches the existing JSONB contract
closely, `config.components` maps onto the existing exhaustive typed registry (`Registry = { [T in
BlockType]: BlockDefinition<T> }`) without a translation layer, and it ships the same same-origin
iframe canvas mechanism D-008 already committed to.

**Cost accepted:** a new external dependency (bus-factor / breaking-change risk that self-owned code
doesn't carry); Puck ships no built-in block library — irrelevant here since the palette is
code-defined regardless of tool; Puck's overrides API is marked experimental by its own docs, so
deep editor-chrome customisation may need rework later; the `content.blocks` array items gain an
`id` field from Puck's `ComponentData` shape (no migration impact — nothing is stored yet, `FND-01`
hasn't shipped).

**Not yet verified:** the integration has not been hands-on tested against a real block. A spike —
wire the Hero block through Puck's config — is recommended before `BLK-03` starts and before day
estimates for `BLK-03`/`BLK-04`/`BLK-07` are re-baselined, the same caution D-008's implementation
note gives for the package extraction.

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
