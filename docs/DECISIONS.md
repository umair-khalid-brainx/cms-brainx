# Decision log

Why non-obvious choices were made, so they are not re-litigated. **Append only.** Never edit or
delete a past entry; if a decision changes, add a new dated entry and state which one it supersedes.

Entries D-001 to D-007 were recorded retroactively on 2026-08-31, when this log was created. The
decisions themselves were made on the dates shown.

---

## D-041 — 2026-10-06 — `admin` gets vitest; canvas actions are tested at the save/load boundary

**Decision:** `admin` now has `vitest` as a dev dependency (`npm test`), the same runner `api` uses.
BLK-03's add/delete/reorder/duplicate are tested through the real `saveDraft` / `publishPage` /
`getPage` in `src/lib/contentApi.ts`, with `fetch` replaced by an in-memory stand-in for the
`/content/:slug` endpoints. Each test builds the `data.content` array a canvas action would produce,
saves it, reloads, and compares.

**Why:** drag and click on Puck's iframe canvas can't be driven headlessly here, but every canvas
action ends as a new `data.content` array, and the only code of ours between that array and
Postgres is the Puck ↔ `cms-blocks` translation (D-015). That translation is where a reorder or a
duplicate could be silently lost, so that's what the tests cover. The interactive half stays a
manual check in a real browser, done by the user (BLK-03's DoD).

**Options considered:** API e2e tests only (no new dependency, but leaves the translation, which is
the riskier half, untested); a browser-automation runner like Playwright (much heavier, and still
fights Puck's iframe drag-and-drop). The user chose vitest in `admin`.

**Cost accepted:** one more dev dependency in `admin`; the test file is inside `src/`, so `tsc -b`
typechecks it as part of `npm run build`. The tests check our translation, not Puck's own
drag-and-drop code.
## D-040 — 2026-10-06 — Video embed: YouTube/Vimeo by pasted link, rendered from a parsed ID (`BLK-02`)

**The ask.** `BLK-02`'s last line item, "embed". Left unbuilt on 2026-09-25 because a general embed
collides with invariant 5 (sanitise on write): sanitising arbitrary `<iframe>` HTML well is hard.

**Options considered.**
- **Raw iframe/embed code.** Most flexible (maps, Calendly, forms). Needs an iframe-aware sanitiser
  on write, which `api` doesn't have even for `richText` yet (`BLK-05`). Rejected for now.
- **Store only the pasted URL; parse it at render.** WordPress's shape (its Embed block stores
  `url` + `providerNameSlug` and fetches the iframe via oEmbed from an allowlist of ~30 providers).
  Every render has to parse messy URLs correctly.
- **Store only `{ provider, videoId }`.** Safe and clean, but the editor can't show back what the
  user actually pasted, and adding oEmbed providers later would mean a data-format change (invariant 7).
- **Store all three: `url` + `provider` + `videoId` (chosen).**

**How.** `VideoEmbedBlock` = `{ heading?, url, provider?, videoId?, caption? }`. The editor's only
input is a "YouTube or Vimeo link" text field; `parseVideoUrl` (`cms-blocks/src/video.ts`) derives
`provider` + `videoId` from it on every save (`admin/src/lib/contentApi.ts`, same edit-shape ≠
stored-shape translation as D-015). An unparseable link saves with neither.

**Why the block re-checks at render.** `api` only validates that a block has a `type`
(`content.dto.ts`), so stored JSON can hold anything. `videoEmbedSrc` builds the iframe `src` from
a fixed template per provider, only after the ID matches that provider's format (YouTube: 11 chars
of `[A-Za-z0-9_-]`; Vimeo: digits). `url` is never rendered. A tampered row renders nothing, not a
frame pointing elsewhere. This is not "sanitise on read" — nothing stored is cleaned and emitted;
the stored value is only used to pick from two known URLs.

**Choices inside it.**
- YouTube plays from `youtube-nocookie.com` (no tracking cookies until the visitor presses play).
- No valid video → the block renders nothing on the public site; the editor shows its own
  placeholder (in `admin/src/puck/config.tsx`, not in the block) so the block stays selectable.
- `referrerPolicy="strict-origin-when-cross-origin"` — YouTube refuses embeds that send no referrer.

**Not covered.** Start time (`?t=30` is kept in `url` but not played from), unlisted Vimeo videos
(need the `?h=` hash), and any provider beyond the two. Each is additive: new optional fields or a
new `provider` value, no change to already-stored blocks.
## D-039 — 2026-10-07 — Public pages use ISR: refreshed on demand by `api`, 60 s backstop

**Decision:** `web`'s tenant page route (`/sites/[subdomain]/[[...path]]`) is ISR. It has
`revalidate = 60` and an empty `generateStaticParams`, so each page renders on first visit and is
then served from Next's cache, and its API fetches are cached for 60 s too. `api` keeps it fresh: when
`ContentService.update` changes a page that was live before or after the write (publish, unpublish,
archive, or saving a live page), `RevalidationService` POSTs `{ subdomain, path }` to `web`'s
`/__revalidate` with a shared secret. `web` then calls `revalidatePath('/sites/<sub><path>')`.

**Why the tenant can't leak:** the cache entry is the rewrite destination, which contains the
subdomain (D-030, invariant 6). Tested with two hosts: a refresh of `kestrel.lvh.me/capability` left
`corrick.lvh.me/` and `kestrel.lvh.me/` as cache HITs.

**Options the user chose between:**
- **Triggers:** publish/unpublish/archive and saving a live page are pushed. Theme, site-name and
  subdomain changes are not; they wait for the 60 s timer (the user accepted that delay).
- **If `web` is down:** the change still succeeds. The call has a 2 s timeout and never throws, it logs
  a warning, and the 60 s timer is the backstop. Refusing to publish when the cache can't be told
  would let a `web` outage block every editor.

**Mechanics worth knowing:** `/__revalidate` is reserved on every host. Like `/__preview`
(D-037) it's mapped in `src/proxy.ts`, to `/internal/revalidate`, which can't be reached directly.
`revalidatePath` must name the rewrite destination, not the visitor's URL (Next 16 docs). A route
handler's `revalidatePath` makes the next visit render fresh (MISS), not stale. The timer is
stale-while-revalidate: after 60 s, the first request still gets the old page and triggers the
re-render, and the one after it is fresh. ISR is off under `next dev`, so check caching with
`next build && next start`.

**Known costs (review, 2026-10-07):** anyone can now fill the cache. Every unknown path or subdomain
writes a cached 404 to disk (`B-17`). `/__revalidate` answers on every public host, guarded only by
the secret, so nginx should block it outside localhost (`B-18`, `DEP-01b`). The call to `web` is
awaited, so a slow `web` adds up to 2 s to a save. That's deliberate: a page opened from the editor
right after publishing must already be fresh.

---

## D-038 — 2026-10-07 — Starter layouts are one global table, not per site

**Decision (user's call):** `TYP-05`'s four starter layouts (Landing, About, Contact, Article) live in
`starter_layouts`: key, name, description, `blocks` (JSONB, the same contract as `content.blocks`)
and sort order. One set is shared by every site. The seed upserts them by `key` from
`api/prisma/starter-layouts.ts`. `GET /starter-layouts` (`content:write`) lists them for `TYP-04`.

**Options:** a global table (chosen); a copy per site (each tenant could tweak its own, but that
means tenant scoping and seeding per site for a read-only list nobody edits yet); or a JSON file in
`api` (simplest, but invariant 8 asks for "data, not code-defined blocks", and a table is
what makes that true).

**Why no `siteId`:** this is platform data, like the block registry, not tenant content. Invariant 1
("every content method takes `siteId`") is about tenant content, so `StarterLayoutRepository` is the
one repository with unscoped reads, and its header comment says why. If tenants ever get their own
layouts, that's a new `siteId`-scoped table, not a column added to this one.

**Also:** the layouts use generic placeholder copy and no block that needs an image, so a page made
from one passes `CNT-12`'s publish checks as-is. `starter-layouts.spec.ts` enforces that, along with
"registry block types only".

---

## D-037 — 2026-10-07 — Preview links: one stored random token per page, no expiry, revocable

**Decision (user's call):** `CNT-09`'s "signed, expiring token" became a stored, unguessable link.
`preview_links` holds one row per page with a 32-byte random token (base64url, 43 chars). It has no
expiry: it works until someone turns it off (`DELETE /content/:slug/preview-link`). Anyone with
`content:write` can create, read or revoke it. It shows the page's latest saved blocks, draft or
published, and keeps working after publish. Archived pages give 404, and the link can't be
created for them. Archiving doesn't delete the link, so restoring the page brings the same link
back. That's deliberate: archive is reversible, and the link goes with the page.

**Why stored, not a signed JWT:** a JWT can't be revoked before it expires, and the user wanted no
expiry and manual revocation. The token is stored as-is, not hashed, because the editor shows the
same link again. Cost: someone with read access to the database could read live preview links.

**How it stays tenant-safe:** the row carries `siteId`. The public lookup
(`PreviewLinkRepository.findPageByToken(siteId, token)`) is scoped by the site of the host the link
was opened on, so site A's token on site B's host matches nothing. `findLiveByPath` is untouched;
previews are a separate door that needs the token.

**How `web` serves it:** `src/proxy.ts` rewrites `<sub>.<root>/__preview/<token>` to
`/preview/<sub>/<token>`. That's a `force-dynamic` route outside `/sites`, so it can never enter a
page's ISR cache (`CNT-08`). No slug can start with `_`, so the path never shadows a page. The API
sends `Cache-Control: private, no-store` and `X-Robots-Tag: noindex`, and the page sets
`robots: noindex`. Bad, revoked, foreign and archived tokens all get the same 404.

---

## D-036 — 2026-10-07 — Publish checks live once, in `api`; they gate moves to `published`, not autosaves

**Decision:** the rules that stop a page going live (`CNT-12`) are one module,
`api/src/content/publish-checks.ts`. `ContentService.update` runs them on any `PATCH` that sets
`status: published` (publish, restore to published, re-publish from the editor) and answers `422`
with `{ errors, warnings }`, one entry per problem with block index, type, label, field and message.
`GET /content/:slug/checks` returns the same for the saved page. `admin` never re-implements them:
the editor calls `/checks` before publishing and both screens render the API's list.

**Rules (chosen by Claude at the user's request):** errors for no blocks, blank required text,
half-filled or missing required links, missing required images, empty lists, and an unknown block
type; a warning only for an image with no alt text (user's choice).

**Why one copy in `api`:** the API is the enforcement point (a client can `PATCH` directly), and a
second copy in `admin` would drift. `api` can't import `cms-blocks` (D-012), so the block shapes are
hand-written; `publish-checks.spec.ts` reads `cms-blocks/src/types.ts` and fails when a block type
is added there without a rule here. Cost: adding a block (e.g. `BLK-02`'s embed) now also means adding
its rule, or pages with it can't be published — fail-closed on purpose.

**Why not autosaves:** a page has one `blocks` column, so the editor's autosave on an already-live
page writes straight to the live page. Checking those saves would refuse an edit mid-typing (say,
clearing a headline to retype it) and lose work. So a live page can still be autosaved into a broken
state; the real fix is separate draft and live content (revisions, `GOV-01`), not a stricter check.

---

## D-035 — 2026-10-06 — Subdomain lookup cached in `api`: id only, misses never cached

**Decision:** `api` keeps an in-memory `subdomain → siteId` map (`api/src/sites/subdomain-cache.ts`,
`SubdomainCache`) in front of `SiteRepository.findBySubdomain` for the public endpoints (`FND-04`).

**Options the user chose between:**

- **Where:** `api`, not `web`. The rename (`SitesService.updateSubdomain`) runs in the same process,
  so it clears the entry directly. A cache in `web` would never hear about a rename.
- **What:** the site id only, not the whole site row. Name and theme are read fresh, so editing them
  never has to remember to clear this cache. Cost: `GET /public/sites/:subdomain` still does one
  `findById` for name/theme; the page endpoint saves its lookup entirely.
- **Misses:** never cached. A free subdomain can be claimed by a rename at any time and must resolve
  at once. Cost: requests for unknown subdomains each hit the DB. Side benefit: the map can't grow
  beyond the number of sites, so no size limit is needed.

**Also:** found entries expire after 5 minutes as a safety net. With one API process the explicit
invalidate is what matters; with more than one (e.g. a PM2 cluster) another process's rename isn't
seen, and the TTL bounds how long the old name keeps resolving. A generation counter stops a lookup
that was in flight during a rename from writing the old mapping back.

---

## D-033 — 2026-10-06 — Tickets live in `tickets/`, one file each; `STATUS.md` owns status

**Decision:** every ticket from `EXECUTION_PLAN.md` now has its own file, `tickets/<ID>.md`, in the
workflow kit's format (goal, Definition of Done checklist, technical notes, history), and
`tickets/STATUS.md` is the **only** place ticket status is recorded. `EXECUTION_PLAN.md`'s ticket
tables lost their Status column and keep estimates, weeks and dependencies only.

**Options the user chose between:**

- **IDs:** kept the existing IDs (`CNT-07.md`) rather than renumbering to the kit's `T-001`. Every
  decision, worklog entry and commit already cites these IDs; renumbering would orphan all of them.
- **Status:** one source (`STATUS.md`) rather than keeping `EXECUTION_PLAN.md` in sync with it. Two
  copies of status drift; this file has already corrected stale rows twice (2026-09-28).
- **Definition of Done:** drafted from the repo (plan rows, decisions, invariants, code) rather than
  waiting. The kit expects DoD copied word for word from `docs/use-cases.md`, which doesn't exist,
  and the published plan with the original acceptance criteria isn't shared with the account
  working on this repo. Every drafted item is marked **Draft** and must be confirmed before
  `/build` runs that ticket.

**Deviations from the kit, on purpose:**

- `BACKLOG` is an extra status (`XRP-03`) so `/build`, which runs every `TODO`, skips it.
- Done tickets were built before the kit existed, without its tests. Their files say so instead of
  ticking "All tests pass. Reviewer approved. Verifier passed."
- `docs/plan.md` and `docs/use-cases.md` still don't exist, so `/build`'s own pre-checks will stop
  until they do (or until those checks are adapted to `EXECUTION_PLAN.md`).

---

## D-032 — 2026-10-06 — `archived` is a page status, not a separate flag; status changes via one dropdown

**Supersedes D-029's storage choice** (archive as a nullable `archivedAt` alongside `status`). D-029's
server-side rule — hard delete only from archived — stands unchanged.

**The ask.** Replace the per-row Archive button with a status dropdown on the Pages list, listing
every status except the one the page is already in, so archive, restore, publish and unpublish are
all the same gesture. This also closes `CNT-11`'s missing third ("restore").

**The problem it exposed.** Under D-029, an archived page still carried `status = draft | published`
underneath; "archived" lived in a second column. The dropdown treats Draft/Published/Archived as one
choice of one thing, which the data didn't.

**Options considered.**
- **A — keep two fields, dropdown is UI-only.** Zero migration. But every future public read (the
  real host-resolved route, `CNT-07`) must check *both* `status = published` *and*
  `archivedAt IS NULL`; one query that forgets the second serves an archived page live on a client's
  site. Safety by remembering.
- **B — `archived` as a third `ContentStatus` value (chosen).** "Is this page live?" is one check,
  `status = published`. An archived page can't also be "published", so there's no contradictory
  state to forget about. Same reasoning as invariant 1: structural, not remembered.

`CNT-07` (D-030) landed the same day with exactly option A's two-condition read
(`findLiveByPath`: `status: 'published', archivedAt: null`). Merged here, it's now
`status: 'published'` alone.

**How.** `ContentStatus` gained `archived`, in its own migration — Postgres won't use a new enum
value inside the transaction that added it — followed by a backfill migration setting
`status = 'archived'` wherever `archived_at` was set. `archivedAt` is kept purely as the "archived
on" date for display: set on entering `archived`, cleared on leaving it; nothing reads it as truth.
`PATCH /content/:slug/archive` is removed — every move goes through `PATCH /content/:slug`
`{ status }`.

**Permissions.** Entering *or leaving* `archived` needs `content:delete` (D-029's tier for archiving,
now also for restoring). Moving to `published` still needs `content:publish`, so restoring straight
to published needs both. Checked in `ContentService.update`; admin's dropdown just leaves out options
a role can't use (UI affordance, `admin` invariant 3).

**Restore target is chosen, not remembered.** No "status before archiving" is stored — the dropdown
makes the user pick Draft or Published when restoring, which answers the question explicitly instead
of guessing.

**Delete Permanently is deliberately not in the dropdown.** Every dropdown move is reversible; hard
delete isn't. Keeping it as its own red button on the Archived tab means a mis-click in the menu can
never destroy a page.

---

## D-031 — 2026-10-06 — Site staff can rename their subdomain; the old one dies (`CNT-07`)

**Decision:** an Owner or Administrator can change their site's subdomain from **Settings → Site
Address** in `admin`. Folded into `CNT-07` at the user's request rather than left as `BACKLOG.md`
B-14, since the subdomain column is introduced by the same ticket.

- **Who:** Owner and Administrator, through a new `site:manage` permission
  (`api/src/auth/permission.ts`), checked by `PermissionsGuard` on
  `PATCH /sites/:siteId/subdomain`. Editors and below get 403; `admin` shows them the field read-only.
- **Rules,** in `api/src/sites/dto/site.dto.ts`: trimmed and lowercased; one DNS label of 3–63
  lowercase letters, digits or hyphens, starting and ending with a letter or digit; not on the
  reserved list (`admin`, `api`, `www`, `app`, `mail`, `cdn`, `static`, `assets`, `status`, `help`,
  `support`, `docs`). `admin` and `api` matter most: they are the platform's own production hosts.
- **Taken:** 409 "That address is already taken". Checked first for a clear message, and backed
  by the unique index, so two sites claiming the same name at once can't both win.
- **The old address dies.** No redirect, no reservation. The old subdomain immediately renders the
  platform's "There's no site at this address" page (404) and is free for any site to claim. The user
  chose this over redirecting; a redirect would touch `GOV-05`.
- **Confirmation:** `admin` asks before saving and names both addresses. Same `window.confirm`
  pattern as archive and delete (D-029).

**Where the build differs from D-030's description:**

1. The internal route is `/sites/[subdomain]/...`, not `/_sites/...`. In the App Router a folder
   starting with `_` is a private folder and never becomes a route. The proxy also sends every
   non-tenant host to a 404, so `/sites/corrick` can't be reached directly on `127.0.0.1:3000`.
2. Nothing is cached yet: `web` fetches with `no-store`, so a publish or rename shows on the next
   request. The rewrite is still what `CNT-08` needs; it adds ISR and revalidation on top.

**Two 404s, deliberately different.** An unknown subdomain gets a plain platform page
(`web/src/app/not-found.tsx`), since there's no site whose branding could apply. A missing, draft or
archived page on a real site gets `web/src/app/sites/[subdomain]/not-found.tsx` inside that site's
own header, footer and theme.

---

## D-030 — 2026-10-06 — Public site: tenant by subdomain, published pages only (`CNT-07`)

**Context:** `web`'s only page route was `/preview/[site]/[[...path]]`, rendering hardcoded fixtures
in `web/src/fixtures/`, never the database. Every `api` content endpoint sits behind `JwtAuthGuard`,
so an anonymous visitor had no way to get a page at all. `CNT-07` replaces that stand-in.

**Decision, in five parts:**

1. **A new unauthenticated read path in `api`.** Returns a page only when `status = published` **and**
   `archivedAt IS NULL`. Drafts, archived pages and pages of any other site return a plain 404,
   indistinguishable from a page that doesn't exist, so a visitor can't probe for unpublished paths.
   The filter lives in `ContentRepository` (invariant 1: scoping is structural), not in the controller
   or in `web`. Archived counts as "not live" even though it's a separate column, not a `status` value:
   archiving a page takes it off the public site.
2. **Tenants are addressed by subdomain.** `sites` gains a unique `subdomain` column (`corrick`). A
   visitor's host has a configured root domain stripped from it and the remainder is looked up by
   `subdomain`. `sites.host` stays as it is, reserved for real custom domains later (`DEP-02`).
3. **Root domain is per environment.** `lvh.me` locally (`corrick.lvh.me:3000`): a public DNS wildcard
   that resolves every subdomain to `127.0.0.1`, the same approach Rails apps use. Production's root is
   still open (`DEC-2`); only the env var changes.
4. **`web` reads the host in middleware and rewrites**, e.g. `corrick.lvh.me/wholesale` → internal
   `/_sites/corrick/wholesale`. The tenant becomes part of the route, so Next's cache key includes it
   (invariant 6), which is what `CNT-08` (ISR revalidation) builds on. Reading `headers()` inside the
   page was rejected: it forces every request to render dynamically, and `CNT-08` would have to undo it.
5. **No fixture content is migrated into the database.** `web/src/fixtures/`, the `/preview/[site]`
   route and the `/` comparison view are deleted (`BACKLOG.md` B-07). The public site shows whatever
   is in the DB, which today is Corrick's Home page only. The Kestrel tenant disappears until
   `GOV-08a`.

**Options considered for the host lookup:** (1) the `subdomain` column, chosen; (2) keep only `host`
and have `web` rewrite `.lvh.me` to the production root before lookup. Rejected (2) because it's a
dev-only translation hack tied to a production domain that isn't decided yet, and it would occupy
`host`, which custom domains need.

**Known caveat:** `lvh.me` depends on public DNS, so local development of the public site needs a
network connection. If that bites, `*.localhost` resolves offline in modern browsers and only needs
the root-domain env var changed.

**Not decided here:** whether site staff can change their own subdomain. Raised in the same
conversation, tracked as `BACKLOG.md` B-14.

---

## D-029 — 2026-09-28 — Page soft-delete: archive is a state, not a route guard trusted client-side

**Decision:** `Content` gets a nullable `archivedAt` column instead of a separate trash table.
`PagesListPage.tsx` has two tabs — **Pages** (`archivedAt: null`, the only place an editor works day
to day) and **Archived** (`archivedAt` set). The Pages tab only offers **Archive**; the Archived tab
only offers **Delete Permanently**. `ContentService.remove` (the hard `DELETE /content/:slug`) now
throws `ConflictException` if the page isn't already archived — so "archive first" is enforced by
`api`, not just by which button `admin` happens to render. Per `admin/CLAUDE.md` invariant 3
("permission checks here are UI affordance, not enforcement — the API enforces"), the same standard
applies to this two-step delete flow: a direct `DELETE` call against a live page is refused with 409,
not just hidden from the UI.

**Why a column, not a trash table:** identical reasoning to D-023's `Role` enum vs. a `roles` table —
nothing here needs to be queried independently of its parent row, there's no metadata beyond "when,"
and a second table would need its own tenant scoping duplicated for no payoff. `ContentRepository`
gained `findManyArchived` alongside the existing `findMany` (which now filters `archivedAt: null`);
no new repository.

**Permission reused, not split:** both `PATCH /content/:slug/archive` and `DELETE /content/:slug` are
gated on the existing `content:delete` permission — an Editor/Administrator/Owner can do either,
Author/Contributor can do neither. Archiving isn't given its own weaker permission tier, since it
already removes a page from the live site (same blast radius class as deleting it, just reversible at
the DB level for now).

**Explicitly not built — restore.** `CNT-11`'s original scope ("Trash, restore, permanent delete")
includes restoring an archived page back to active. The user's ask for this pass was archive +
hard-delete only, no restore UI/endpoint; an archived page can currently only be hard-deleted, never
brought back, short of an operator running `UPDATE content SET archived_at = NULL` by hand. Logged as
a gap in `BACKLOG.md`, not hidden — add a `POST /content/:slug/restore` (clear `archivedAt`) plus an
Archived-tab button when asked for.

---

## D-028 — 2026-09-28 — Puck's native Publish button does render after all; suppressed, not deleted

**Supersedes D-019's finding, not its decision.** D-019 (2026-09-25) traced into Puck's bundled
source and concluded its native Publish button never reaches the DOM in `@puckeditor/core@0.23.0`,
and built `EditorPage.tsx`'s own `.editor-publish` button as a guaranteed-to-work replacement. That
specific finding — "it doesn't render" — is wrong as of today, checked directly: Puck's own button
(a `<span class="_Button..._Button--primary...">Publish</span>` inside its header's `_PuckHeader-tools`,
not even a `<button>` element, which is why an early check today missed it too) genuinely renders and
genuinely works — clicked it directly, confirmed it fires the same `onPublish` callback and the page's
`updated_at` moved in Postgres. Nothing about `package.json` changed (`@puckeditor/core` is still
exactly `0.23.0`); why the original trace concluded otherwise is unresolved and not worth chasing
further — what matters is today's directly-observed behavior, not re-litigating a two-day-old trace.

**Decision: keep the custom button, suppress Puck's — don't delete the custom one and rely on Puck's
native button instead.** Both work identically (same `onPublish`/`publishNow()` call), so this is
purely about which one to keep, not a functionality gap. `EditorPage.tsx`'s own button is the one kept
— it doesn't depend on Puck's internal rendering staying stable release to release, and its behavior
is fully owned by this codebase rather than something a future Puck version could silently change
again. `<Puck overrides={{ headerActions: () => <></> }} />` empties Puck's header-actions slot
(`headerActions` is one of Puck's documented `overrideKeys`); `onPublish` stays wired on `<Puck>`
regardless, so Puck's button would still work correctly if the override were ever removed — it's
hidden, not disconnected.

**Verified for real:** CDP against the real editor confirmed exactly one element with the text
"Publish" exists post-fix (`document.querySelectorAll('*')` filtered to leaf nodes), confirmed the
Puck header-actions container is now empty, then clicked the one remaining button and confirmed the
status text flips to "Published" — the fix didn't just hide the duplicate, the real one still works.

---

## D-027 — 2026-09-28 — Media picker in block settings (`MED-03`)

**Decision:** `ImageUploadField` (D-025) gets a third action, "Browse", next to the existing paste-a-URL
text field and "Upload" button — opens `components/MediaLibraryModal.tsx`, a grid over the site's
`Media` rows (D-026) filtered to `image/*`; clicking a thumbnail fills the field and closes the modal.
No new API surface — it reads the same `GET /media` `MediaPage.tsx` already uses. Since three controls
no longer fit legibly on one row in Puck's ~250px-wide field panel, the field's layout changed to two
rows (URL input full-width, then Upload/Browse as equal-weight buttons below it) — the previously
side-by-side text-field-and-Upload layout the user asked for in D-025 is preserved in spirit (still
one row, still adjacent), just no longer literally sharing a row with a third control.

**A real, non-obvious Puck gotcha surfaced while verifying this, worth recording so it doesn't cost
someone else a debugging session:** Puck mounts each field's `render` function **twice** — once as a
normal, visible instance inside the sidebar (`_SidebarSection-content`), and once more as a
zero-size, invisible instance inside what its own class names call `_FieldsPlugin` (0×0 rect, still
`display: flex`, still in the DOM). Both instances are wired to the same underlying field value/
`onChange`, so interacting with either one updates the real Puck data identically — a real user, who
can only click the visible one, is never affected. It only matters for **automated testing**:
`document.querySelector`/`querySelectorAll` against a field's class name will match both instances,
and picking the wrong one first can make a script's assertions flicker for reasons that have nothing
to do with the feature under test. Filtering to `getBoundingClientRect().width > 0` isolates the real
one. Documented in `CLAUDE.md`'s gotchas, not worked around in product code — there's nothing to fix.

**Verified for real:** CDP against the real running editor — opened Browse against an empty library
(correct empty-state message), closed it with Escape, seeded one file via the existing Upload button,
reopened Browse and confirmed the grid showed it, clicked it and confirmed the field filled with the
exact matching URL, confirmed the modal closed, confirmed the canvas re-rendered with the selected
image. Screenshotted the open modal (grid of real thumbnails) directly, not just asserted via DOM
state. Test media rows/files and the accidental autosave into the real "Home" page were cleaned up
afterward — twice, since the first cleanup pass missed one leftover row from an earlier test, caught
by checking `psql` before signing off rather than trusting memory of what had been cleaned.

---

## D-026 — 2026-09-28 — Media library backed by a real `Media` table, not a disk listing

**Decision:** `MED-02`'s library page (`GET/DELETE /media`, `admin`'s `/media` grid) reads from a new
tenant-scoped `Media` Prisma model — one row per upload, written by `MediaService.store` right after
the file lands on disk — rather than listing the site's upload directory off the filesystem at
request time. Two real options here, put to the user rather than picked silently:

1. **List straight off disk** (`fs.readdir` + `fs.stat` on `uploads/<siteId>/`, deriving filename/size/
   date from the files themselves). No schema change, ships fastest, matches this project's existing
   "local disk, no S3" minimalism (`ARCHITECTURE.md`'s Media row). Cost: no real metadata (who
   uploaded it, when, by whom) beyond what the filesystem happens to expose, and — since the stored
   filename is a bare `uuid.ext` with the client's original name already discarded at upload time
   (D-025) — no way to show anything resembling the file's original name at all.
2. **A real `Media` table**, tenant-scoped like `Content`/`Invite`, with its own repository. Real
   metadata (`uploadedByUserId`, `createdAt`, `mimetype`, `size`), consistent with how every other
   entity in this schema is modeled — chosen.

**Why the table won:** the filesystem-listing option's real cost wasn't performance (trivial at this
scale), it was that a bare disk listing can't answer "who uploaded this" or "when" at all — the
`uuid.ext` filename D-025 chose specifically to keep unguessable carries zero human-readable
information, so a disk-only library would have to either show a meaningless filename or add metadata
some other way anyway. A table also composes with existing patterns (`MembershipRepository`'s
`*_SELECT` const excluding sensitive fields, `ContentRepository`'s `siteId`-scoped `deleteMany`)
rather than being a one-off.

**`MediaService.store` writes the file to disk, then the DB row** — if the DB write fails, the
request fails and the caller sees an error (the orphaned file on disk is unreferenced and harmless,
never served from any URL the client has). `MediaService.remove` deletes the DB row first, then the
file with `{ force: true }` — a failed file removal doesn't leave a dead API response, just an
orphaned file, same asymmetry accepted in the other direction.

**Still no "used on these pages" tracking before delete** — flagged as a real gap when this was
proposed, not silently dropped. Doing it properly needs either a join table kept in sync on every
`Content.blocks` write, or a runtime scan of every page's JSONB for the URL — both real added scope.
Deleting a file that's still referenced by a page just leaves that page with a broken image; no
warning is shown. Tracked in `BACKLOG.md` B-12 (updated, not superseded — the grid this note replaces
"no library" with still doesn't solve reuse-safety).

**Verified for real:** curl — empty list on a fresh site, upload returns the full row (metadata
correct, no `passwordHash`/`tokenHash`-style leak), list shows it, delete returns 204 and the file is
actually gone from disk (`ls` on the site's upload directory), a second delete of the same id 404s.
CDP — uploaded a real file through the grid's own Upload button, confirmed the card appears, opened
the detail panel and confirmed filename/type/size/uploader render from the real API response, copied
the URL, deleted through the detail panel (auto-accepting the native `confirm()`), confirmed the grid
returns to its empty state. Test rows and files cleaned up afterward.

---

## D-025 — 2026-09-28 — File upload wired directly into image fields, ahead of a real media library

**Decision:** `MED-01`'s first slice, built narrower than the ticket and shaped by what was actually
asked ("wherever we give the option to insert a link for an image, side by side give the option to
upload from computer") rather than the full media-library ticket. New `api/src/media/` — `POST
/media` (`JwtAuthGuard` + `PermissionsGuard`, `content:write`, same permission a content write
already requires), accepting one multipart file, validated against a fixed mimetype allowlist
(`image/png|jpeg|webp|gif|svg+xml`, `video/mp4|webm` — video included for forward-compat even though
no video block exists yet, see below), written to `uploads/<siteId>/<uuid>.<ext>` and served back by
`app.useStaticAssets` under `/uploads`. In `admin`, every `src` field on an image (`Hero.image`,
`ImageText.image`, `LogoCloud.logos[]`, `Gallery.images[]`, `TeamGrid.members[].photo` — all five
places `cms-blocks` has an image URL prop, per a full-repo inventory before writing any code) swapped
from a plain `{ type: 'text' }` Puck field to `{ type: 'custom', render: ImageUploadField }`: a text
input (paste a URL, unchanged) plus an "Upload" button side by side, calling the new endpoint and
filling the same field on success.

**No favicon field or video block exist yet — not built here, scope stayed to what already existed.**
The request named "icon or image or favicon or video" as examples of the pattern ("wherever we give
this option"), not a checklist demanding all four. A repo-wide inventory (grep across `cms-blocks`,
`admin/src/puck/config.tsx`, `SettingsPage.tsx`, `Site` schema, both fixtures) confirmed neither a
favicon field nor a video block exists anywhere in this codebase — `SettingsPage.tsx` has no image
field of any kind, and `theme_json`/`SiteTheme` has no logo/favicon slot. Nothing was fabricated to
fill that gap; if a favicon field or video block get built later, this same `ImageUploadField`
pattern (and the video mimetypes already allowed server-side) covers them without new API work.

**Tenant isolation is the random filename, not an authenticated download route.** `/uploads` is
plain static file serving with no per-request auth check — matches `ARCHITECTURE.md`'s existing
"files on local disk scoped by site; a guessed URL must not cross tenants" line: the site-scoped
directory keeps files organized, but what actually stops cross-tenant access is that the filename is
a `randomUUID()` (128 bits), never derived from anything guessable, and never the client's original
filename (which also closes the path-traversal/extension-spoofing surface a user-supplied name would
open). Accepted for this POC; a real deployment behind the single-box/nginx topology this project
already assumes would likely still serve these as plain static files.

**No thumbnails, no library, no reuse/delete UI — deliberately narrower than `MED-01`'s full
description.** `sharp` thumbnailing, a browsable grid of previously-uploaded files (`MED-02`), and a
"pick from library" affordance instead of "upload a new one" (`MED-03`) are all still open — see
`EXECUTION_PLAN.md`'s `MED` section and `BACKLOG.md` B-12. Every upload today is a new file; there's
no way yet to reuse one already on disk except by copy-pasting its returned URL into another field's
text input, which still works since the text input was kept, not replaced.

**Verified for real:** curl — unauthenticated upload (401), wrong mimetype (400, `Unsupported file
type: text/plain`), a real PNG (201, file confirmed on disk at the returned path, byte-identical on
download, correct `Content-Type`). CDP — selected the Hero block in a real running editor, attached a
real file to the hidden `<input type=file>` via `DOM.setFileInputFiles`, confirmed the returned URL
landed in the text field and the canvas re-rendered with the real uploaded image (not a broken-image
icon), confirmed the change autosaved. Screenshotted the field itself showing the text input and
Upload button side by side. Test upload and its accidental autosave into the real "Home" page were
both cleaned up afterward (file deleted from disk, `content.blocks` reverted via `psql`) so the demo
database wasn't left with test pollution.

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
