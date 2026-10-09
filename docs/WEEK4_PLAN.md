# Week 4 plan (M4)

Drafted 2026-10-09 from a ticket review with the user, after fast-forwarding this branch to `main`
(`b2010c8`: TYP-01 to TYP-04, MED-04, BLK-05/07 all done). Choices below are the user's answers; each
is tied to the client's requirements (`docs/REQUIREMENTS.md`, req. N = section N).
When a step lands, the usual doc rules apply (WORKLOG, STATUS, ticket file, DECISIONS).

**Rule for this week:** build what the requirements and tickets ask for, and make it correct. No
extras. Every screen with UI is designed with the `frontend-design` and `ui-ux-pro-max` skills,
inside the admin's existing look (not a restyle).

## Where week 4 stands

| Ticket | Status | Real state |
|---|---|---|
| GOV-06 | DONE | Roles and team invites |
| SEO-01, SEO-02 | TODO | Only `<title>` exists (`generateMetadata`) |
| TAX-01, TAX-02 | TODO | Unblocked: TYP-01 is done; built-in Posts type has excerpt + featured image |
| GOV-01, GOV-02 | TODO | No revisions table. Blocks carry no stable id once saved |
| GOV-03, GOV-04 | TODO | `SiteSettings.nav`/`footer`/`tagline` are always empty; Settings' title/tagline don't save |
| GOV-05 | TODO | Needs slug editing, which doesn't exist |
| CNT-04, CNT-05, CNT-06 | TODO (week 1) | **Pulled into this week**: no slug editing, no parent pages |

## Decisions made in the review

| # | Question | Answer | Requirement served |
|---|---|---|---|
| 1 | Slug editing (CNT-04) is missing | **Pull CNT-04 into week 4** | Req. 5 "editable URL slug", req. 10 "configure page URLs" |
| 2 | Page hierarchy (CNT-05/06) | **Pull both in, before redirects** | Req. 10 "parent-child page relationships" |
| 3 | SEO-01 scope | **The full req. 5 list**: meta title, description, canonical, social title/description/image, noindex | Req. 5 |
| 4 | Categories and tags | **Site-wide, flat**: one category list and one tag list per site, shared by every type that opts in | Req. 3 |
| 5 | Related posts | **Fold into TAX-02** | Req. 3 "related posts" (was on the out-of-scope list) |
| 6 | When to record a revision | **Publish, status change and restore always; autosave at most one per 10 minutes per user** | Req. 8, 9 |
| 7 | Comparison screen | **Block list with prop diffs** (Added / Removed / Changed, old → new) | Req. 9 "compare revisions" |
| 8 | Header nav vs footer links | **Both are menus**: one builder, two fixed locations (Header, Footer) | Req. 6 "headers and footers", req. 10 |
| 9 | Logo | **Yes, picked from the media library**; also the last-resort social image | Req. 6 "headers" |
| 10 | Restore on a published page | **Replace content, keep status**; a revision of the current state is saved first, so a restore can be undone | Req. 8 "restoration" |
| 11 | How to run | **One branch, ticket by ticket**, reviewer + verifier before each DONE | — |

Defaults I chose without asking (shout if any is wrong):
- **Slugs stay unique across the whole site**, even for child pages. Admin routes by slug alone, and
  this keeps it that way. A child's URL is still nested (`/about/team`).
- **Only pages nest.** Entries of a type always live at `/<prefix>/<slug>`. Depth limit: 3 levels.
- **A parent can't be permanently deleted while it has children** (409), same as types with entries.
  Unpublishing or archiving a parent doesn't hide its children: each page's own status decides
  (WordPress behaves the same).
- **Redirects are 308**, via Next's `permanentRedirect`. The ticket says 301; search engines treat
  308 the same, and it's what Next gives without a custom route handler. Recorded as a decision.
- **Managing redirects needs `content:publish`** (owner, administrator, editor). Auto-redirects are
  created by the server whoever changes the slug.
- **Auto-redirects only for pages that were ever published** (`publishedAt` set). A draft's old URL
  was never public, so it needs no redirect.
- **Menus and branding need `site:manage`** (owner, administrator), like Settings today.
- **Menus nest two levels**: header children show as a dropdown; footer top items are group titles.
- **A menu item points at a page by id, not by path**, so it follows slug and parent changes, and
  hides itself publicly while that page isn't published.
- **Revisions keep the last 50 per page**; older ones are pruned on write. A revision snapshots title,
  blocks, field values, SEO and terms.
- **Diffing aligns blocks by sequence (LCS on type + content)**, because saved blocks have no ids.
  Adding ids to the stored block contract would be a data-format change (invariant 7); not doing it.
- **Category and tag archives live at `/category/<slug>` and `/tag/<slug>`**, list entries of every
  opted-in type, newest first, and are `noindex`. `category` and `tag` become reserved prefixes.
- **Posts has categories and tags turned on** by the seed; new types start with both off.

## Build order and why

`CNT-04 → CNT-05 → CNT-06 → GOV-05 → SEO-01 → SEO-02 → GOV-04 → GOV-03 → TAX-01 → TAX-02 → GOV-01 → GOV-02`

URLs first (slug, parent, path), so redirects are built once against nested paths. SEO before the
sitemap because noindex drops a page from it. Branding before menus because both share the public
header and the site-wide revalidation. Taxonomy before revisions, and revisions last, because a
revision snapshots SEO and terms, which must exist first.

Each ticket: confirm its DoD (rewritten from these decisions in Step 0) → test-writer → build →
`api` test + typecheck + lint, `admin` and `web` build → reviewer → verifier → hand check in the
browser → docs. Design-heavy tickets are marked 🎨.

## Step 0 — Ticket housekeeping (~0.1 d)

- Rewrite the DoD in the 12 ticket files from this plan; drop the "Draft" markers once confirmed.
- `STATUS.md`: CNT-04/05/06 stay under M1 with a note "built in week 4, first (D-052)".
- Ticket headers: dependencies and estimates updated to this plan; these numbers supersede
  `EXECUTION_PLAN.md`'s table for week 4.
- `EXECUTION_PLAN.md`: take "related posts" off the out-of-scope list.
- One DECISIONS entry for the week's scope changes (pulled-in tickets, related posts, menus = footer).

## Step 1 — CNT-04 Slug editing (~0.15 d)

- **API:** `PATCH /content/:slug` accepts `slug`. Server slugifies and checks uniqueness (existing
  `uniqueSlug`), refuses `home` clashes and reserved prefixes / type prefixes. Changing the title never
  touches the slug. Path recompute is CNT-06; until then the single page's path updates.
- **Admin 🎨:** a **Page settings** panel in the editor (a slide-over from the top bar). This one panel
  later holds parent (CNT-05), SEO (SEO-01) and categories/tags (TAX-01), so it's designed once here,
  with sections. URL field shows the full address preview (`corrick.lvh.me/about/team`) and an
  explicit "Change URL" action with a warning for live pages. After a change the editor navigates to
  the new `/editor/<slug>`.
- B-20 (Puck's unsaved page-level title field) is fixed here only if the panel makes it confusing;
  not promised.
- **Tests:** slug normalised, uniqueness per site (same slug in two sites allowed), title edit keeps
  slug, reserved/prefix clash 400/409, permission (`content:write`).

## Step 2 — CNT-05 Parent pages (~0.25 d)

- **Schema:** `Content.parentId` (nullable, self-relation, `onDelete: Restrict`), index on
  `(siteId, parentId)`. Pages only: entries reject a parent (400).
- **API:** set/clear parent on create and update. Guards: parent in the same site (repository scoped
  by `siteId`, invariant 1), not itself, not a descendant (cycle), resulting depth ≤ 3, parent isn't an
  entry. `home` can't have a parent or children.
- **Admin 🎨:** Parent picker in Page settings (searchable list of pages, indented by depth, invalid
  choices disabled with a reason). Pages list shows hierarchy (indented titles, sorted parent-first).
- **Tests:** each guard, including a cycle three levels deep and cross-site parent ids.

## Step 3 — CNT-06 Path recomputation (~0.3 d, band D: review line by line)

- Path = parent path + `/` + slug. A slug or parent change recomputes `path` for the page **and every
  descendant in one transaction, only within that subtree** (invariant 9). Recursive CTE or a loaded
  subtree walk; refuse if any new path collides (409, nothing written).
- Revalidate old and new paths of every live page in the subtree (CNT-08), after commit.
- Returns the list of `{ oldPath, newPath }` moves, which GOV-05 consumes.
- **Tests:** rename a parent with grandchildren; move a subtree under another parent; collision
  rolls back everything; a sibling subtree is untouched; nested paths render in `web` (closes CNT-07's
  "nested paths untested" note) — checked on two hosts.

## Step 4 — GOV-05 Redirects (~0.4 d)

- **Schema:** `Redirect { id, siteId, fromPath, toPath, source: manual | auto, createdById?, createdAt }`,
  unique `(siteId, fromPath)`.
- **Rules (all in one service, all tested):**
  - Auto: every `{ oldPath, newPath }` move from CNT-06 for a page with `publishedAt` creates
    `old → new`.
  - **No chains:** creating `B → C` rewrites any existing `X → B` to `X → C`.
  - **No loops:** a redirect whose target leads back to its source is refused; when a page takes a path
    (any status), any redirect from that path is deleted first, before flattening (the page wins).
  - Manual: from a relative path to a relative path or absolute URL; `fromPath` can't be a live page.
- **Public:** when `web` finds no page, it asks `GET /public/:subdomain/redirect?path=` and calls
  `permanentRedirect`. Creating or deleting a redirect revalidates its `fromPath` (404s are cached,
  B-17).
- **Admin 🎨:** **Redirects** screen (under Settings in the sidebar): table of from → to, source badge
  (Auto / Manual), created date, add form with validation messages, delete.
- **Tests:** chain flattening, loop refusal, page beats redirect, rename back to the old slug, cross-site isolation, `curl -I`
  on two hosts shows 308 and the right `Location`.

## Step 5 — SEO-01 SEO fields and meta (~0.3 d)

- **Schema:** `Content.seo` JSONB `{ metaTitle, metaDescription, canonicalUrl, ogTitle, ogDescription,
  ogImageId, noindex }`, Zod-validated on write (lengths, URL shape, media id belongs to the site).
- **Admin 🎨:** SEO section in Page settings: a search-result preview, a social card preview,
  character counters (60 / 160), "Hide from search engines" toggle, social image via the existing
  media picker.
- **Web:** `generateMetadata` renders `<title>`, `description`, `<link rel=canonical>`, `og:*`,
  `twitter:card`, and `robots: noindex` when set. Fallbacks: title → `Page · Site`; description →
  excerpt field → none; social title/description → meta values; social image → featured image (GOV-04 adds the
  site logo as the last resort); canonical → the page's own URL. Type listing pages get the same treatment.
  Public 404s get "Page not found · Site" (B-15).
- **Tests:** metadata function unit tests for every fallback; `curl` page source on two hosts.

## Step 6 — SEO-02 sitemap.xml and robots.txt (~0.2 d)

- **Proxy:** `web/src/proxy.ts` matcher lets exactly `/sitemap.xml` and `/robots.txt` through to the
  tenant rewrite (today everything with a file extension is skipped).
- **Routes:** `app/sites/[subdomain]/sitemap.xml/route.ts` and `robots.txt/route.ts`.
- **API:** `GET /public/:subdomain/sitemap` returns published, non-noindex pages and entries
  (`path`, `updatedAt`), plus each type's listing. Drafts, archived, noindex and category/tag
  archives never appear. Revalidated on publish/unpublish/SEO change.
- `robots.txt` allows everything and points at that host's sitemap.
- **Tests:** two hosts never share entries; draft, archived and noindex pages absent; valid XML.

## Step 7 — GOV-04 Branding, header and footer content (~0.3 d)

- **Schema:** `Site.settings` JSONB `{ tagline, footerNote, logoMediaId }`; `name` stays a column.
- **API:** `GET/PATCH /sites/current/settings` (`site:manage`); public site payload includes them and
  the logo URL.
- **Revalidation:** header and footer are on every page, so a settings change refreshes the whole
  site. Adds `revalidation.site(subdomain)` (a per-site cache tag in `web`). GOV-03 reuses it.
- **Admin 🎨:** Settings → General: Site title and Tagline finally persist (replaces
  `admin/src/data/site.ts` stand-in values), logo picker, footer note.
- **Web 🎨:** header shows logo (alt = site name) or the wordmark, plus tagline; footer shows note.
  The logo joins SEO-01's social-image fallbacks as the last resort.
- **Tests:** settings scoped per site; two hosts show their own header; logo from another site's
  media refused.

## Step 8 — GOV-03 Menu builder (~0.9 d, band C)

- **Schema:** `MenuItem { id, siteId, location: header | footer, parentId?, position, label,
  contentId?, url? }`. A page item stores `contentId`; a custom item stores `url`.
- **API:** `GET /menus/:location`, `PUT /menus/:location` replaces the whole tree in one transaction
  (simpler and safer than per-item moves); validates depth ≤ 2, content ids belong to the site, URL
  shape. Public payload resolves page items to current paths and **drops items whose page isn't
  published**. Revalidates the whole site.
- **Admin 🎨:** **Menus** screen with Header / Footer tabs. Add pages (searchable) or custom links,
  edit label, drag to reorder and nest, plus keyboard / button controls (up, down, indent, outdent) so
  it works without a mouse and on tablet. Library chosen at build time (`@dnd-kit` is already pulled
  in by Puck); recorded as a decision.
- **Web 🎨:** header renders the menu with accessible dropdowns (hover + keyboard + tap) and a mobile
  menu; footer renders groups.
- **Tests:** tree validation, hidden unpublished pages, link follows a slug change, two hosts.

## Step 9 — TAX-01 Categories and tags (~0.3 d)

- **Schema:** `Term { id, siteId, kind: category | tag, name, slug }` unique `(siteId, kind, slug)`;
  `ContentTerm { contentId, termId }`; `ContentType.hasCategories`, `hasTags` (seed turns both on for
  Posts).
- **API:** terms CRUD (`content:publish` to manage the lists; anyone with `content:write` can assign
  existing tags and create a new tag while tagging, as in WordPress). Assigning terms validates the
  type opts in and every term belongs to the site. Deleting a term removes its links.
- **Admin 🎨:** **Categories & Tags** screen (two lists, add / rename / delete, entry counts). In the
  entry's Page settings: category checkboxes and a tag token input with suggestions. Type form gets
  the two opt-in switches.
- **Tests:** site scoping, opt-in enforced, cross-site term ids refused, delete unlinks.

## Step 10 — TAX-02 Archives and related posts (~0.3 d)

- **Public:** `/category/<slug>` and `/tag/<slug>` list published entries with that term, newest
  first, paginated like the type listing (reuses TYP-03's listing). `robots: noindex`. Unknown term
  → 404.
- The entry header shows its categories and tags as links to those archives.
- **Related posts:** under a published entry, up to 3 newest published entries of the same type
  sharing a category, falling back to a shared tag; the section is absent when there are none.
- Revalidation: publishing or retagging an entry refreshes its term archives.
- **Web 🎨:** archive heading, term chips, related-posts cards (colour only via `--site-*`,
  invariant 2).
- **Tests:** only published, only this site, noindex present, related excludes the entry itself.

## Step 11 — GOV-01 Revisions (~0.4 d)

- **Schema:** `Revision { id, siteId, contentId, title, blocks, data, seo, termIds, status, reason:
  publish | status | restore | autosave, authorId, createdAt }`, through a scoped repository.
- **When:** publish, status change and restore always create one. An autosave creates one only if
  the same user's latest autosave revision of that page is older than 10 minutes; otherwise it
  overwrites that one (so the newest state is always kept). Keep the last 50.
- **Restore:** saves the current state as a revision, then replaces title, blocks, data, SEO and terms
  with the snapshot, status unchanged; a live page revalidates.
- **Admin 🎨:** **History** panel in the editor: list grouped by day, each row with time, author,
  reason badge, Restore (with a confirm that says when the page is live) and Compare.
- **Tests:** throttle window, pruning at 50, restore round-trip, permission, site scoping.

## Step 12 — GOV-02 Revision comparison (~0.5 d, band C)

- **Diff:** a pure function `diffBlocks(a, b)` in `admin` aligning blocks by LCS over type +
  content, then per aligned pair listing changed props. Rich text compared as plain text with
  word-level highlights. Title, fields and SEO diffed as key/value rows above the blocks.
- **Admin 🎨:** **Compare** screen: pick two revisions (defaults: selected vs current), rows tagged
  Added / Removed / Changed / Unchanged (collapsed), old → new for changed props, Restore button for
  the older side.
- **Tests:** `diffBlocks` cases: insert, delete, move, prop change, rich-text word change, identical.

## Estimate

| Step | Days |
|---|---|
| 0 Housekeeping | 0.1 |
| 1–3 Slug, parent, path | 0.7 |
| 4 Redirects | 0.4 |
| 5–6 SEO, sitemap | 0.5 |
| 7–8 Branding, menus | 1.2 |
| 9–10 Taxonomy, related | 0.6 |
| 11–12 Revisions, compare | 0.9 |
| **Total** | **~4.4 d** |

Over a 5-day week with the hand checks, it fits with little slack. If it runs late, GOV-02 is the one
to trim (compare blocks only, no word-level highlights).

## Not in this week (explicitly)

- GOV-07 submit-for-review workflow (week 5).
- Per-author content ownership; Viewer role.
- Nested categories, per-type taxonomies, custom taxonomies.
- Redirect hit counts, regex redirects, 410 Gone.
- Visual (rendered) revision diff.
