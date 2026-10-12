# Decision log

Why non-obvious choices were made, so they are not re-litigated. **Append only.** Never edit or
delete a past entry; if a decision changes, add a new dated entry and state which one it supersedes.

Entries D-001 to D-007 were recorded retroactively on 2026-08-31, when this log was created. The
decisions themselves were made on the dates shown.

---

## D-059 — 2026-10-12 — Menus: saved whole, pages by id, buttons first (`GOV-03`)

**Decision (the week 4 plan, D-052; the parts worth recording):**

- **Two menus per site, header and footer** (`MenuItem`, location, position), each a list of top items with at most one level of
  children, up to 20 and 20. An item is **a page by id** (so it follows the page's slug, parent and moves) **or a custom link**
  (a path, an anchor, an `http(s)` address, `mailto:` or `tel:`; never a script, a protocol-relative or any other scheme).
  The title is editable and starts as the page's.
- **Saved whole.** `PUT /menus/:location` takes the tree the editor ended up with, checks all of it (every page must be a page
  or entry of this site, any status), and replaces the stored menu in **one transaction under a per-site lock**; nothing changes
  if any part is refused. A site-wide refresh follows. `site:manage` to save; every role may read.
- **What a visitor sees** (`api/src/menus/menu-tree.ts`, tested): a page item shows at the page's **current** address; an item
  whose page is **not published is not shown**, whatever its status (draft, archived, gone). A top item whose own page is hidden
  but which has shown items under it stays as a **heading with no link**, so those items aren't lost; with none, it goes.
- **A menu change, or a page in a menu going live, off or moving, refreshes the whole site** (by the site's cache tag, D-058),
  because the header and footer are on every page. A page that isn't in any menu costs one count query.
- **Footer:** each top item is a group's title (a link when it has an address of its own), the items under it its links.
- **The builder moves items with buttons first** (up, down, put under the item above, move out) and, with a mouse, by dragging a
  handle: before an item, after it, or inside it (making it a child, only where the two-level rule allows; otherwise it falls back
  to the nearest allowed place). No drag library: `@dnd-kit` is only a dependency of Puck, with a beta API, and native
  drag events don't work on touch, which is why the buttons are the primary way and work for a keyboard, a screen reader and a
  finger alike. Changes are announced in a live region; focus follows the item.
- **The header navigation** is the disclosure pattern: a link plus a separate toggle button (Esc closes it and returns focus to the
  button; a click or tap elsewhere closes it); on a wide screen hover opens it too; on a narrow screen a "Menu" button opens
  a list with everything shown and no toggles.
- **Menus live in `ContentModule`** with redirects (D-055), for the same reason: moving or hiding a page changes them.

**Costs and limits:** the picker adds pages, not entries (use a link to a post's address); no menu for the archive or category
pages (`TAX-02` adds those addresses as links); one header and one footer per site, no other locations; two administrators saving
the same menu at once: the last save wins whole, never half of each; drag and drop is mouse-only; unsaved edits are guarded
against closing or reloading the tab but not against clicking another admin screen (B-32).

---

## D-058 — 2026-10-12 — Site identity: stored once, refreshed by tag (`GOV-04`)

**Decision (the week 4 plan, D-052; the logo and the refresh method are the parts worth recording):**

- **`Site.settings`** holds the tagline, the footer note and a logo; the **title stays `Site.name`**, the column every
  picker and page title already uses. `PATCH /sites/:siteId/settings` (`site:manage`: owners and administrators) takes any
  of the four and changes only those; `GET /sites/:siteId` now returns them too (every role may read). Limits: 100, 120 and 400
  characters; nothing is written if any part is refused.
- **The logo is a picture from the site's own library.** The same rule as the social image (`SEO-01`) keeps another
  site's folder out, and the service also checks that the file is in this library and is an image, so a deleted or
  non-image file is refused. On the public site a logo whose file has since left the library is simply not shown.
- **Header and footer:** the logo replaces the name in the header (its alternative text is the site name); the
  tagline sits beside it and the footer note under the name, each only when set. **The logo is the last social image
  fallback** (after a chosen image and an entry's featured picture), with the site name as its alternative text.
- **A settings change refreshes every page of that site, by tag.** `web` reads the site, and each page, with a
  per-site cache tag (`site:<subdomain>`); the revalidate endpoint, called without a path, refreshes that tag.
  Refreshing a path or a layout did not work: the header comes from the site data every page reads, and a page's own tags
  and social picture are worked out from the site's name and logo, and only a tag reaches those cached reads. One site's
  tag never touches another's (invariant 6). Checked: after a title, tagline or logo change, every page of that site
  (home, nested, an entry, a listing) showed it on the very next request, and the other site's pages were unchanged.
- **The logo counts as "in use" in the media library.** The warning before Delete lists "The site's logo (every page)" next to
  the pages that use a file, and deleting the file takes the logo off the site and refreshes every page, so no cached header
  keeps pointing at a missing file. One helper (`MediaRepository.findImage`) decides what a usable picture is, for saving a logo
  or a social image and for showing it; a logo path is checked again on the way out, so a value edited by hand in the database
  never becomes a picture address; and the logo is only looked up when nothing else would be a page's social picture.
- **The admin follows at once:** the Settings card saves through the API and updates the stored session, and the site
  picker in the layout subscribes to the session, so a new title shows in the top bar without a reload. The stand-in values
  in `admin/src/data/site.ts` are gone.

**Costs and limits:** no per-page logo, no separate dark-mode logo, no favicon. Anyone can read the site's settings in the admin
(they are public on the site anyway). The header's navigation and the footer's link groups come with `GOV-03`. Two admins saving
different settings at the very same moment can overwrite each other: a save reads the current settings, merges what it was sent and
writes the whole object (acceptable for a site with a couple of administrators; B-31). Each page cache miss reads the site and its logo
again for the page's tags, on the API side only (B-31).

---

## D-057 — 2026-10-12 — Sitemap and robots.txt: per tenant, built on every request (`SEO-02`)

**Decision (the week 4 plan, D-052; one part changed after testing):**

- **Each tenant host serves its own `/sitemap.xml` and `/robots.txt`.** The proxy's matcher, which skips every path
  with a file extension, gained exactly those two entries, so nothing else with an extension is let through; the
  rewrite sends them to `/sites/<subdomain>/sitemap.xml` and `/robots.txt`, so the host picks the tenant as for pages.
  On a host that isn't a tenant they are a 404.
- **What the sitemap lists** (`api/src/public/sitemap-view.ts`, from `GET /public/sites/:subdomain/sitemap`): the site's
  live pages and entries that aren't switched to noindex (`SEO-01`), with when each last changed, plus a listing
  (`/blog`) for each type that has an indexable entry, as new as its newest. Drafts and archived pages never come back
  from the query, and category and tag archives (`TAX-02`) are noindex, so they never get here. A page whose parent is
  unpublished is still listed: each page's own status decides (D-054). Capped at the 50,000 addresses a file may hold.
- **`robots.txt` allows everything and names that host's sitemap**; the address is built from
  `PUBLIC_SITE_URL_TEMPLATE` (D-056).
- **Both are built on every request, not cached.** The plan was to cache them like pages and refresh them from `api`.
  Tested in `next dev` and in a production build, `revalidatePath` clears a route file's cached output but not the API
  answer behind it, so the sitemap stayed behind a publish. A page's cache entry is tied to the page's path; a route
  file's fetch is not. So the routes are `force-dynamic` and read the API with `no-store`: never stale, one indexed
  query per fetch, and crawlers fetch a sitemap a few times a day. The refresh calls that were added on the `api` side
  were removed again rather than kept as dead code.
- **`web` gets `npm test`** (Node's built-in runner, `node --test`, on `src/lib/*.test.ts`; Node 24 runs TypeScript
  directly), because the XML builder and the tag mapping (`SEO-01`) are logic. `allowImportingTsExtensions` in its
  tsconfig lets the tests import `./x.ts`; the project never emits files, so it is safe.

- **Each route refuses a host that isn't its tenant.** A path with a file extension skips the proxy, so
  `/sites/<x>/sitemap.xml` could be asked for on any host and would have returned `<x>`'s sitemap (found in review,
  confirmed with `curl`). The route now checks the request's `Host` (`isOwnHost`) against the tenant in its path, and
  answers 404 otherwise: invariant 6 holds for the new files too.
- **A page whose canonical address is another one isn't listed** (a sitemap names canonical addresses; listing a page whose
  own `<link rel="canonical">` points elsewhere sends conflicting signals). `api` sends each entry's canonical address and
  `web`, which knows the origin, drops the entry unless it names the page itself (ignoring a trailing slash).
- **The 50,000-address limit** of a sitemap file is kept: past it, the last pages by address are dropped and the type
  listings stay (so the file stays valid), and a warning is logged. **`Cache-Control: no-cache`** on both files says it
  plainly: a copy may be kept, but ask again before using it.
- **Node 22.6 or later is needed to run `web`'s tests** (`npm test`), not to run the site.

**Costs and limits:** an unauthenticated request reads a site's live rows each time (fine at this scale; an nginx
`proxy_cache` of a minute would cap it, a deploy decision for `DEP-01b`, B-30). Past the limit a site's last pages are
left out of the sitemap, noindex rows count toward the read cap, and there is no sitemap index. No image or video
sitemaps, no `hreflang`. `robots.txt` reads the site through the 60-second cached `getSite`, so a deleted site's
`robots.txt` can outlive it by a minute.

---

## D-056 — 2026-10-12 — SEO: one validated object, fallbacks resolved in `api`, tags built in `web` (`SEO-01`)

**Decision (the week 4 plan's choices, D-052: the full req. 5 list; built as planned):**

- **`Content.seo`, one JSON object** on pages and entries alike: meta title, meta description, canonical address,
  social title, social description, social image, and noindex. Saved whole, validated on write (`api/src/content/seo.ts`):
  text has a hard limit (120 for titles, 320 for descriptions) looser than the **advice the editor shows (60 and 160)**,
  the canonical address must be a full http(s) address, and the social image must be a file of **this site's own**
  library (the same rule as an entry's media field). Nothing is written if any part is refused.
- **Fallbacks are resolved in `api`**, in a pure function (`api/src/public/seo-view.ts`), so each rule has a test:
  title → "Page · Site" (the home page is just the site's name); description → an entry's first text field, cut to a
  search-result length, else none; social text → the meta text; social image → the chosen file, else an entry's first
  picture field (`GOV-04` adds the site logo last). A chosen image that was deleted from the library, or isn't a
  picture, quietly falls back.
- **`web` only turns that into tags** (`web/src/lib/seo.ts`): title, description, canonical, Open Graph, Twitter card
  (`summary_large_image` only when there is a picture), and `robots: noindex, nofollow` when switched on. The canonical
  address defaults to the page's own, built from **`PUBLIC_SITE_URL_TEMPLATE`** (`{subdomain}` replaced): only `web`
  knows its public origin, and reading the request's host in `generateMetadata` would make every page dynamic and break
  the host-keyed cache (invariant 6).
- **No description tag when there is none.** The root layout used to carry the platform's own description, which every
  tenant page inherited; it is gone, so a page without a description says nothing rather than something false.
- **The 404 tab says "Page not found · <site>"** (B-15). A page that calls `notFound()` doesn't pass its metadata on,
  so the title is set by the tenant segment's `not-found.tsx`.
- **Copying a page copies its search settings but not its canonical address**: two pages naming the same canonical
  would tell search engines they are one.

**Costs and limits:** a noindex page also leaves the sitemap (`SEO-02`); the editor can't show an entry's summary as the
description preview (it doesn't load the entry's type fields), so it says "Search engines will pick text from the page";
no structured data (JSON-LD), no per-language tags. `web` has no test runner, so the tag mapping is checked on the page
source with `curl`, not unit-tested.

---

## D-055 — 2026-10-12 — Redirects: flat, a page always wins, automatic on a move (`GOV-05`)

**Decision (the week 4 plan's defaults, D-052; built as planned):**

- **A `redirects` table per site**: from a path on the site to a path on the site or a full `http(s)` address,
  marked `auto` or `manual`. Paths are stored normalised (lowercase, no trailing slash, no query).
- **Never a chain, never a loop.** Adding B → C re-points every A → B to A → C, and A → B when B → C exists is
  stored as A → C, so every redirect is one hop. One that would lead back to its own address is refused. The rules
  are pure functions (`api/src/redirects/redirect-rules.ts`); every change runs under a per-site lock and writes
  only the differences.
- **A page always wins.** A manual redirect can't start at an address a page has (any status) or a type's listing;
  when a page takes an address (create, copy, move), any redirect from it is removed. So renaming a page back to an
  old slug never loops: the page reclaims the address first.
- **Automatic on a move** (`CNT-06`'s `moved` list): every address that changed, for pages that were ever
  published (`publishedAt` set or live now). A draft's old address was never public, so it gets none.
- **The public site asks last**: `web` looks for a page, then a type listing, and only then a redirect, answering
  with Next's `permanentRedirect` — a **308**, which search engines treat like the ticket's 301. Every address whose
  answer changed is revalidated, since `web` caches 404s and redirects alike.
- **Managing needs `content:publish`** (it changes where public addresses go); anyone who can read content can see
  the list. Redirects live in `ContentModule` rather than a module of their own: a move makes them and they check page
  addresses, so two modules would import each other.

- **"A page wins" is checked against the pages as they are when redirects change**, read under the redirects lock,
  not against what a move remembered: two quick moves whose redirect updates land in the wrong order still end right.
- **Addresses are plain printable ASCII** after percent-decoding, like page addresses. Redirect lookups ignore case
  (old links typed with capitals still land); page addresses are always lowercase slugs, so `/About` is a 404 when only
  the page `/about` exists. Deliberate, not an oversight.

**Costs and limits:** no hit counts, no wildcard or regex redirects, no 410 Gone (out of scope, plan). The content write
and the redirect update are two transactions: if the redirect update fails after a move, the move still succeeds, the
failure is logged, and staff can add the redirect by hand. A draft that never went live gets no redirect when it moves,
so a manual redirect that pointed at its old address now leads to a 404. A content type created later with a prefix
equal to an existing redirect's address wins on the public site; the redirect row stays until someone deletes it.

---

## D-054 — 2026-10-12 — Parent pages: paths rebuilt from parent links, one transaction per move (`CNT-05`, `CNT-06`)

**Decision (the week 4 plan's defaults, D-052; built as planned):**

- **`Content.parentId`**, pages only, same site, at most **3 levels** (top level is 1), never a loop. The home
  page has no parent and no children. A page with children can't be permanently deleted (409, and the foreign
  key is `Restrict`); unpublishing or archiving a parent doesn't hide its children.
- **The parent link is the truth and `path` is derived from it.** A move (new slug, new parent, or both)
  rebuilds the path of the page and every descendant from the parent links (`api/src/content/page-tree.ts`),
  not by string-replacing stored prefixes, so a stale stored path is corrected on the next move. The page and its
  descendants are written in **one transaction**, so a move lands whole or not at all (invariant 9); any new path
  that clashes with a page outside the subtree refuses the whole move (409).
- **The tree is read and written under a per-site lock** (a Postgres advisory lock held by that transaction).
  Moves and creates-under-a-parent on one site run one at a time and plan from the tree as it is then, so two
  crossing moves can't make a loop and a page created under a parent that's moving can't keep a stale path.
  Verified with two crossing moves fired at once: one wins, the other is refused.
- **A move answers with the addresses it changed** (`moved: [{ from, to }]`), which `GOV-05` turns into redirects.
- **Slugs stay unique across the site** (D-052), but **reserved words and type prefixes only apply at the top
  level**: `/about/search` is fine, and moving that page to the top is refused until its slug changes.
- **Moving needs `content:publish` if any page that moves is live**, not only the page itself (a draft parent
  with live children moves live addresses).
- **The admin's parent picker is a native `<select>` with a "Find a page" search box** that filters by title.
  Options read title first, then where they sit and why they can't be chosen ("Leads (under Team, too deep)"):
  leading dashes for depth broke the browser's type-to-jump. Archived pages are listed too, since they're still
  in the tree. The API stays the authority.

**Costs and limits:** the whole page tree of a site is loaded for each move or create-under-parent: fine at a
site's page count, not for tens of thousands of pages. Sibling order isn't stored (the Pages list keeps its
last-edited order within each level); menus (`GOV-03`) carry their own order.

---

## D-053 — 2026-10-09 — Changing a page's address: explicit, publish-tier when live, unique per site in the database (`CNT-04`)

**Decision (the user chose the permission rule after the reviewer raised it):**

- **A slug changes only when someone asks for it**, in the editor's Page settings panel. The title never
  changes it. The server normalises whatever is sent (lowercase, accents dropped, single hyphens, 80
  characters at most) and only the normalised slug and its path are written.
- **Moving a live page needs `content:publish`**, the same tier as publishing, because it changes the
  public site (and until `GOV-05`, breaks the old link). Anyone with `content:write` can still move a draft.
  In this project's role table that blocks only Contributors: Authors hold `content:publish`.
- **Refused, with a message for the person:** the home page, a reserved word (pages only; an entry sits
  under its type's prefix), a content type's prefix (pages only), and a slug already used anywhere in the site.
  Creating a page avoids the same words by adding a suffix (`sitemap-2`), so both paths follow one rule;
  `home` stays allowed on create, where it makes the home page.
- **A slug is unique per site in the database too** (`@@unique([siteId, slug])`), not only in the service's
  check: two moves racing to the same slug would otherwise both pass the check, and a page and an entry could
  share a slug because their paths differ. The losing write is answered with the same 409.
- **The admin's editor follows the page to its new URL without reloading**, after saving any edit not yet
  saved; a move with nothing unsaved sends only the slug.

**Costs and limits:** the normaliser exists twice (`api/src/content/slug.ts` for the rule, `admin/src/lib/slug.ts`
for the live preview), kept in step by a shared table of test cases. Creating a page has the same check-then-write
race; the index now turns it into an error instead of a duplicate, but `create` doesn't map it to a 409 yet.

---

## D-052 — 2026-10-09 — Week 4 scope: URL tickets pulled in, menus include the footer

**Decision (week 4 ticket review with the user; full list in `docs/WEEK4_PLAN.md`):**

- **`CNT-04`, `CNT-05`, `CNT-06` are built first in week 4.** Nothing could change a slug yet, so
  req. 5's "editable URL slug" and `GOV-05`'s auto-redirect had nothing to hang on; and req. 10 asks
  for parent pages. Doing hierarchy before redirects means slug changes handle child paths once.
- **SEO-01 covers all of req. 5**: canonical, separate social title/description, and noindex, not just
  title/description/image. A noindex page also leaves the sitemap.
- **Categories and tags are site-wide and flat**, shared by every type that opts in.
- **Related posts moves into `TAX-02`** (it was on the out-of-scope list): same type, shared category,
  else shared tag, up to 3.
- **Revisions:** always on publish, status change and restore; autosave (every 500 ms in the editor)
  makes at most one per page per user per 10 minutes. **Restore keeps the page's status**: edits to a
  live page already go live, so "restore as draft" would have taken it offline.
- **Comparison is a block list with prop diffs**, matched by sequence, because saved blocks carry no
  id and adding one would change the stored contract (invariant 7).
- **Header nav and footer links are both menus**: one builder, two fixed locations. `GOV-04` keeps
  tagline, footer note and a logo picked from the media library.
- **Redirects answer with 308** (Next's `permanentRedirect`), not the ticket's 301. Search engines
  treat them the same, and 301 would need a custom route handler for no gain.
- **Slugs stay unique site-wide, even under different parents**, because admin routes by slug alone.

**Costs and limits:** week 4 grows by about 1.3 days, from 3.1 to ~4.4 (0.7 for the three pulled-in tickets, the rest from
related posts and wider SEO, taxonomy, branding and revision scope); if
it runs late, `GOV-02`'s word-level highlights are cut first. Site-wide slugs mean `/about/team` and
`/careers/team` can't both exist.

---

## D-051 — 2026-10-09 — Starting a page from a layout: the server copies it (`TYP-04`)

**Decision (the week 3 plan the user approved; the user declined a new "Campaign" layout):**

- **The create screen offers Blank and the four seeded layouts** (Landing, About, Contact, Article) as radio
  cards with the layout's description and the blocks it contains, in the editor's own block names. It is the
  same screen for pages and for entries of any type. Nothing new is added to the layout list (req. 6's
  "campaign pages" stays a layout the client can build from Landing; no extra data was invented).
- **The server does the copying.** `POST /content` takes a `layout` key, loads the blocks from the platform's
  own `starter_layouts` table and stores a copy (`structuredClone`, then the usual sanitising). The browser
  never sends the layout's blocks, so a page can only start from what was seeded; sending blocks together with
  a layout is a 400, an unknown key a 404. Layouts are platform data, not tenant content, so this is the one
  read that takes no site (D-038).
- **Defaults:** Blank for pages and custom types, Article for the built-in Posts type. If the layouts can't be
  loaded the screen still makes a blank page.
- **A copy, not a link:** later changes to the seed don't reach pages already made from it.

**Costs and limits:** the cards show the blocks' names, not a picture of the layout; a client can't save their own
page as a template (not in the requirements).

---

## D-050 — 2026-10-09 — Entries get an automatic header and a type listing, from the existing route (`TYP-03`)

**Decision (the week 3 plan the user approved):**

- **No per-type routes.** The existing catch-all route serves everything: it looks up the page; if there is none
  and the path is a single segment, it asks for a type listing at that address (a page can never take a type's
  address, D-048, so the two can't clash). A new type needs no deploy.
- **The entry header is automatic**, built from what each field *is*, not from a template per type
  (`cms-blocks/src/EntryHeader.tsx`): the title, the author's name and the first-publish date; the first picture
  as the lead image; an excerpt or summary (fields named `excerpt`, `summary`, `intro`, `standfirst`, or any text
  over 80 characters) leading under the title; short text, choices and dates as a quiet facts list; links as
  buttons and other files as downloads ("Slides (PDF)"); formatted text as the body, each under its field's
  name. The entry's own blocks follow. The two-column layout only appears when there is body text.
- **The listing is a ruled list, not a grid of cards** (`EntryList.tsx`): date, title linking to the entry,
  a short summary (the first short-text field, cut to 200 characters) and the first picture. Newest first by
  publish date, up to 50 (paging arrives with the archive pages, TAX-02).
- **Publish date:** `content.published_at`, set the first time an entry or page goes live and kept after;
  existing live rows took their last-edited time in the migration.
- **What the public API returns:** `entry` on a page (type names, author's **name only**, date, and each visible
  field with a value, shaped for display; media as a full address with the library's alt text and kind; a file
  deleted from the library is left out) and `GET /public/sites/:sub/types/:prefix` for the listing. Hidden
  fields are never sent. Values are shown as saved (invariant 5); media is stored short and given the API's
  address here. A missing type, another site's type and a draft are all the same 404.
- **Freshness:** publishing, unpublishing, archiving or saving a live entry refreshes its page and its type's
  listing (`/events`), as well as the page, through the existing on-demand refresh (CNT-08).
- Private preview links show the same header.

**Costs and limits:**

- The excerpt rule uses four field names (`excerpt`, `summary`, `intro`, `standfirst`); a differently named short
  text is a fact, not a lede.
- Entries have no SEO fields or social image yet (`SEO-01`), and no categories or tags (`TAX-01`/`TAX-02`).
- A listing shows the newest 50; there is no paging or search.
- A document is a download link named after its field and file type, not its title.
- An entry made only of field values (no blocks) can be published; a page still needs a block.
- A listing's address is exact (`/Events` is a 404, not a second URL); a NUL character in a public address is a 404.
- The full address of media comes from `API_PUBLIC_URL` (root `CLAUDE.md` gotchas, `DEP-01b`).
- A file used only in an entry's field now counts as "used on" that entry (deleting it warns).

---

## D-049 — 2026-10-09 — Custom fields: six fixed kinds, validated on write, edited in the editor's side panel (`TYP-02`)

**Decision (the week 3 plan the user approved; the six kinds were the user's choice):**

- **The six kinds:** short text, formatted text, date, media (an image or any library file), choice from a list,
  link. The list is fixed (root invariant 8): `FIELD_KINDS` in `api/src/content-types/field-definitions.ts`, and
  the value rules are a record keyed by it, so a seventh kind without its rule doesn't compile. The API refuses
  an unknown kind; adding one is a re-estimated change.
- **Storage:** `content_types.fields` (JSONB list of `{ key, label, kind, required, options? }`) and
  `content.data` (JSONB, values by field key). No separate table per type.
- **The key is made once, from the name, and never changes** (`event_date`), because values are stored under
  it. A saved field's kind can't change (its values would be misread); its name, "needed" flag, options and
  position can. Removing a field only hides it: it stays in the type's list, marked hidden, and its values stay
  in each entry's `data`. A field added later with the same name **and kind** gets the old key back (and so
  its values); a different kind always gets a fresh key (`photo_2`), because the old values were checked as
  another kind and would otherwise be read as the wrong one (plain text showing up as formatted text would
  skip the sanitiser). Hidden fields are never validated, required or shown.
- **Every write is checked in the API** (Zod, by kind): text up to 500 characters; formatted text cleaned with
  the same sanitiser as page rich text (invariant 5); date as `YYYY-MM-DD` and a real date; media must be
  `/uploads/<this site>/<file>`, with or without the API's address in front, and is stored in that short
  form (any host is dropped; query strings, other paths and other sites' folders are refused; `web` adds the
  API's address when it shows the file); a choice must be one of the options; a link must start with `https://`,
  `http://`, `mailto:`, `/` or `#` and have text. All problems are returned together, by field name. A blank
  value clears the field. Values for fields the type doesn't have are ignored, and a hidden field's value is
  left alone. A page (no type) can't take values.
- **"Needed before publishing" is a publish check, not a draft rule:** a draft saves with it empty; a live entry
  can't have a needed field emptied (the same 422); publishing returns 422 with `Fill in "Speaker"` in the same list as the block problems (CNT-12's shape).
- **Where staff edit them:** the editor's side panel when no block is selected (Puck's "page" panel), built per
  type from its field list (`admin/src/puck/entryFields.tsx`), so there is one editor for every type. This also
  removes Puck's default "title" box, which saved nowhere (B-20). The blocks and the values are saved by two
  requests, so a value the API refuses never costs the blocks; the editor says "Fields not saved: ..." with
  the API's words.
- **Built-in Posts** carries an excerpt and a featured image (migration and seed).

**Costs and limits:**

- A formatted-text field in the side panel has the toolbar but no on-canvas editing (the root panel has no canvas).
- A media field can hold a document, but nothing shows it publicly yet (`TYP-03`).
- Keys are not shown to staff; two fields can't share a name (it would give the same key).
- Hidden values stay in the database forever; there is no "purge hidden data" action.
- A choice field's value is checked against its options when saved, not again at publish: removing an option
  leaves entries that already chose it holding a value no longer listed (B-27).
- The form sends the field list only when its own person changed it; two admins changing one type's fields at
  the same moment is still last write wins.

---

## D-048 — 2026-10-09 — Content types: a table, a locked address, entries reuse the Pages screens (`TYP-01`)

**Decision (the week 3 plan the user approved):**

- **Data:** `content_types` (plural name, singular name, address prefix, built-in flag), unique per site by
  prefix, read and written only through `ContentTypeRepository`, which requires `siteId`. `content` gains a
  nullable `typeId` (null = an ordinary page) and `authorId` (who created it; the public entry header will show
  it, TYP-03). Every site gets a built-in **Posts** type at `/blog`: existing sites through the migration
  (skipped for a site that already has a page at `/blog`), seeded sites through the seed.
- **Who:** anyone who can read content sees the types (they feed the sidebar); creating, renaming and deleting
  need `site:manage` (owner, administrator), like WordPress's Administrator.
- **The address is chosen carefully.** One segment of lowercase letters, digits and single hyphens, 2 to 40
  characters; not a reserved word (`admin`, `api`, `preview`, `internal`, `category`, `tag`, `sitemap`, ...);
  not another type's; not an address a page already uses (archived pages count). It can change only while the
  type has no entries (archived ones count) and never for a built-in type, because moving it would break every
  entry's link and redirects are `GOV-05`. A type can be deleted only when it has no entries and isn't built
  in. The API's messages are written for staff and shown as they are.
- **Entries live at `/<prefix>/<slug>`** and use the existing editor, statuses, archive and duplicate. The Pages
  screens take an optional type (`GET /content?type=events`, `POST /content {type}`), so a type's list is the
  Pages list pointed at it; the two lists never overlap. A copy of an entry stays in its type.
- **Slugs stay unique across the whole site**, because admin routes by slug alone (`/content/:slug`), so an
  entry and a page can't share one. A *page* also can't take a type's address: asking for `events` gives
  `events-2`.
- **Navigation:** types load once into a context shared by the whole admin; the sidebar lists each under Pages
  and the Types screen reloads the context after every change, so the menu changes with no reload.

**Not here:** custom fields on a type (`TYP-02`), the public listing and entry header (`TYP-03`), categories and
tags (`TAX-01`). Entries are already reachable on the public site at their address through the existing
catch-all route, rendered from their blocks.

**Costs and limits:**

- Slug uniqueness across types is a limit a client can notice (a page and an event can't both be "summer").
- The signed-in user's first site is used for every content call, as everywhere else (D-023).
- A type can't be moved once it has entries; staff would have to delete the entries first.

---

## D-047 — 2026-10-09 — Media documents and library text; alt text is a live-site fallback (`MED-04`)

**Decision (user's call on the fallback):**

- **Documents:** PDF, Word (`.docx`) and Excel (`.xlsx`) upload to the same library (req. 4). They get no
  thumbnail; the library shows a labelled file tile. The browser's claimed type isn't trusted: the first
  bytes must be `%PDF-` (within the first KiB) or a zip header, otherwise the upload is refused. Applies to
  replacing a file too. Uploads are served with `X-Content-Type-Options: nosniff`.
- **Library text:** `media` gets `alt`, `title` and `description` (nullable, per site, via
  `PATCH /media/:id`, `content:write`). A new file's title starts as the name it was uploaded with
  ("Price list 2026.docx" becomes "Price list 2026"), so the library isn't a wall of generated names; the
  stored file name stays our own (direction-override characters are removed). Alt text is for images
  only (setting it on a PDF is refused with 400). Title and
  description are for the library; they are not shown on the live site.
- **Alt text reaches pages as a fallback, not a copy.** When the public page is read, an image of this
  site's own uploads whose `alt` is empty gets the library's alt text (`api/src/public/image-alt.ts`, one
  scoped query per page view, none when every image has its own). Text typed on the page always wins. The
  stored page is never changed (invariant 7), so there are no stale copies and a change in the library
  reaches every page. Changing a file's alt text refreshes the live pages that use it (CNT-08's
  revalidation, in parallel batches of 10). This adds information on read; it doesn't clean anything, so it isn't the "sanitise on
  read" invariant 5 forbids.

**Options not taken:** copying the library text onto the page when the image is picked (each page gets its
own copy to edit, but later library changes don't reach it and a hand-typed link gets nothing; also needs a
way for one Puck field to set its sibling).

**Costs and limits:**

- Documents can't be picked into a page yet: the image picker and the editor's upload stay images only
  (the editor's upload box refuses a non-image in the browser; the API itself still takes documents, as it
  must). A document field is `TYP-02`'s media field.
- **An empty alt means "use the library's", so a page can't mark an image decorative.** In HTML an empty
  alt is how an image is declared decorative, and the editor can't tell "left blank" from "decorative". A
  decorative flourish whose library file has alt text will be announced by a screen reader. A per-image
  "decorative" switch would fix it (B-25).
- **Changing a file's alt text changes live pages without a publish step.** `PATCH /media/:id` needs
  `content:write`, so a contributor can do it; replacing a file already worked the same way (MED-02).
- The signature check is a sanity filter, not a validator: a zip passes as a Word or Excel file, and the
  PDF header only has to appear in the first KiB. The real protections are that the served type comes
  from our own generated extension and `nosniff`.
- Office files the operating system labels with no type or `application/octet-stream` are refused as
  "unsupported" (B-25).
- The fallback matches on the `/uploads/<siteId>/<file>` part of the address, so an image hosted
  elsewhere with that same path would also get this site's text; nothing crosses sites.
- The page alt fallback matches on the stored file name inside `/uploads/<siteId>/`; an image hosted
  elsewhere, or a library file that is later deleted, gets no fallback.
- PDFs are served inline from the API's address. A PDF reader runs in the browser's own sandbox, and
  `nosniff` stops the browser treating other files as pages; if documents ever need to be forced to
  download, that is a `Content-Disposition` header on `/uploads`.

---

## D-046 — 2026-10-09 — Inline editing uses Puck's `contentEditable`, no `Editable` primitive (`BLK-07`)

**Decision (follows D-045, the user's call):** a text field edits on the canvas when its Puck field has
`contentEditable: true`. Puck swaps the prop for an editable `<span>` inside the block's own heading or
paragraph; typing writes the same prop the sidebar field edits (checked: canvas and sidebar show the
identical text, autosave stores it, it survives a reload). The ticket's idea of an `Editable` primitive
in `cms-blocks` is not built: it would duplicate what Puck already does.

- **Scope:** every top-level `text`, `textarea` and `richtext` field except two (`ContactForm.submitLabel`,
  the text inside a `<button>`; `VideoEmbed.url`, never rendered as text). A test
  (`admin/src/puck/config.test.ts`) fails when a new text field is added without the flag.
- **Not possible in place:** text inside lists (FAQ answers, team members, pricing plans, feature items),
  link/button labels and image alt text and captions (hero, image-and-text, gallery, team photos),
  because Puck only edits top-level fields. They stay in the sidebar.
- **No change to the stored data or the public site.** The blocks already render these props as children,
  and on the public site they are plain strings. Only one block used a text prop as an attribute (the
  video's `<iframe title>`); it now ignores non-string values.
- **Rich text:** the canvas floating menu is Puck's action bar. Its default has underline (switched off
  here), so `RichTextInlineMenu` replaces it with the same controls as the sidebar toolbar, from one
  shared component: H2, H3, bold, italic, bulleted and numbered lists, quote, and link (the address box
  opens as a small popover under the bar).
- **`data-puck-rte-menu` is required on both menus.** Puck ends a rich-text editing session the moment
  keyboard focus moves to anything outside an element carrying that attribute; without it the link box
  (or Tab into the menu) closed the floating menu. Found in the review, and tested: select a word on the
  canvas, click Link, type an address, Enter gives `<a href="https://…">` with the menu staying open.
  While editing on the canvas the sidebar shows no toolbar of its own, so this menu is the only one.
- **Line breaks:** Enter in a plain-text field inserts a line break (in the sidebar and on the canvas), so
  `Prose` and the testimonial quote now use `whitespace-pre-line`; before, the canvas showed the break
  and the public site collapsed it.

**Costs and limits:**

- A text field left empty (optional or not) renders as a zero-size editable span in the canvas, because Puck
  always passes a node, so it can't be clicked, and every `value ? <wrapper>` check in a block is true
  there. Most blocks therefore show blank structure the public site doesn't: an empty eyebrow or body
  adds gaps in the hero, an empty video caption leaves a bordered strip, a feature grid or FAQ keeps its
  heading area, a testimonial shows a lone "—". Fill empty ones from the sidebar. (B-24)
- Nothing but the types stops a block author using a top-level text prop as a string. Instead a test
  (`admin/src/puck/inline-render.test.ts`) renders every block with editable nodes and fails on a throw,
  on `[object Object]`, or when an editable value isn't drawn.
- Press-and-type is plain text for `text`/`textarea` fields (`contenteditable="plaintext-only"`), as it
  is in the sidebar.

---

## D-045 — 2026-10-09 — Rich text: Puck's built-in `richtext` field, a custom toolbar, `sanitize-html` on write (`BLK-05`)

**Decision (user's calls):**

- **Editor:** Puck 0.23's own `richtext` field (it is TipTap underneath), not a separate TipTap
  integration. It stores the same plain HTML string in the same `html` prop, so the stored block
  shape (invariant 7) and the public renderer are unchanged. The same field gives `BLK-07` its
  on-canvas editing (`contentEditable`). Spike result: in the sidebar and the canvas the field edits
  the live prop, autosave stores the HTML, and old pages load into it.
- **Toolbar:** exactly the client requirements' set (req. 2) plus bold and italic: Paragraph /
  Heading / Subheading (h2, h3), bold, italic, bulleted and numbered lists, quote, link. Puck's default
  toolbar has no quote or link button and shows underline and alignment greyed out, so it is replaced
  (`admin/src/components/RichTextToolbar.tsx`) and the unused extensions are switched off in
  `richTextOptions`. Links are plain: TipTap's defaults (`target="_blank"`, `rel="nofollow"`) are
  removed, because they open a client's own pages in new tabs and add `nofollow` (req. 5).
- **Sanitising:** `api/src/content/sanitize.ts` (`sanitize-html`) runs on create, update and duplicate
  for every `richText` block's `html`. Allowlist = what the toolbar can produce: `p br h2 h3 strong em
  ul ol li blockquote a`; `a` keeps only `href`, with schemes `http`, `https`, `mailto` or a relative
  address. Everything else is dropped (scripts, handlers, styles, images, iframes). `<b>`/`<i>` become
  `<strong>`/`<em>`. A link whose address was refused becomes plain text. It runs before the publish
  checks, so they judge what would be stored. `web` renders stored HTML as-is (invariant 5).
  (The unlinking is a plain text unwrap of bare `<a>` tags on the already-clean output, not a second
  `sanitize-html` pass: a function-form `transformTags` leaks state in sanitize-html 2.18 and turned
  the next unrelated closing tag into `</span>`. Found by the verifier, covered by regression tests.)
- **Typography:** headings, lists, quotes and links are styled in `cms-blocks/src/RichText.tsx`, using
  only `--site-*` variables, so the editor canvas matches the public site (before, only `web` had a
  few rules, and the canvas showed plain text). The old rules in `web/src/app/globals.css` are gone.

**Why not the alternatives:** a separate TipTap setup would be a second editor to keep in step with
Puck's, for no visible gain; a hand-built `Editable` primitive (the ticket's first idea) is more code
for the same result.

**Costs and limits:**

- Rows saved before this are not rewritten: they are sanitised the next time they are saved or
  duplicated, and a publish that sends no `blocks` publishes them as stored (B-22). Existing seed
  content only uses `p` and `h2`, so nothing visible changes.
- Unsupported tags are dropped to bare text rather than converted, and `tel:` links are not kept
  (B-23). A rich-text `html` that is not a string is refused with 400.
- In the canvas Puck passes the field as a rendered node, not a string, so `RichText` accepts either
  (string on the public site, node in the editor).
- Only `richText.html` holds HTML. FAQ answers are plain text and stay so; a new block with an HTML
  prop must be added to `sanitizeBlocks`.
- Puck's field panel is one `<form>`: a nested `<form>` in a custom field submits it and reloads the
  editor. The toolbar's link box is a plain `div` that handles Enter itself.

---

## D-042 — 2026-10-06 — Contact form submissions go through `web`, guarded by a shared secret (`BLK-06`)

**Decision:**

- **Route:** the `ContactForm` block posts to a Next.js server action in `web`. `web` resolves the
  site from the request host (as it does for pages) and forwards to the API at
  `POST /public/sites/:subdomain/submissions`. The browser never sends a `siteId` and never calls
  the API directly, so no per-tenant CORS is needed.
- **Shared secret:** `web` sends a secret header (env var on both sides); the API rejects a
  submission without it. Without this, the public endpoint could be called directly, bypassing
  every check in `web`.
- **Spam:** both a honeypot field (filled → silently dropped) and a rate limit of 5 submissions per
  minute per visitor IP. The rate limit lives in `web`, because only `web` sees the visitor's IP —
  to the API every submission comes from `web`'s server. In-memory counter: fine on the single EC2
  box, resets on restart. The IP is the last `X-Forwarded-For` entry, so the limit is only as good
  as the proxy in front: `next dev` passes a client-sent header through unchanged (verified), and
  production needs nginx to overwrite it with `$remote_addr` (DoD item added to `DEP-01a`).
- **Storage:** a `submissions` table, accessed through a repository whose methods require `siteId`
  (invariant #1). Answers are JSONB, an ordered array of `{ name, label, value }` — the editor
  defines the fields per block, JSONB objects don't keep key order, and the label snapshot keeps an
  old submission readable after a field is renamed. The API reads the form's fields from the live
  page (`blocks[blockIndex]`), never from the request, so required fields and email format are
  enforced server-side; unknown keys are dropped.
- **Who reads them:** a new `submissions:read` permission for Owner, Administrator and Editor.
  Submissions hold visitors' personal details, so Author and Contributor don't get them.
- **cms-blocks stays network-free:** `ContactForm` gets its submit function from a
  `ContactFormProvider`. `web` provides its server action; the editor canvas provides none, so the
  form there is a preview that never sends. `BlockRenderer` now passes each block its `index`.
- **Admin:** list plus detail view in `BLK-06`. Status (New → Read → Handled) and internal notes
  (author + timestamp) are split into `BLK-08`. The visitor's answers are never editable — the
  record must show what the customer actually sent.

**Options the user chose between:**

- Route: through `web` (chosen) vs browser → API with `siteId` in the body (anyone can post to any
  site, and CORS for every subdomain).
- Rate limit: in `web` + shared secret (chosen) vs in the API trusting a forwarded-IP header
  (spoofable by calling the API directly) vs per-site limit (one bot blocks real customers).
- Admin "edit": status only (chosen) vs editing the visitor's answers vs both.

**Cost accepted:** one more env var in `web` and `api`; rate-limit state lost on restart; ticket
split adds `BLK-08` (status + notes) rather than doubling `BLK-06`'s 0.5-day estimate. Delete, email
alerts and CSV export are backlog (B-16).
## D-044 — 2026-10-07 — Media replace keeps the URL, same type only; "used on" is a runtime scan (`MED-02`)

**Decision:** three choices, all confirmed with the owner before building.

1. **Replace in place** (`PUT /media/:id`) overwrites the file on disk and keeps its URL, so every
   page using it shows the new file with no edits. **The new file must be the same mimetype.** The
   URL ends in the original extension (`uuid.png`), and a `.png` URL serving JPEG bytes would be
   misleading. The write goes to a temp file first and is then renamed over the original. Rename is
   atomic, so a visitor gets either the old file or the new one, never half of one.
2. **Deleting a file a page still uses warns, but is allowed.** The confirm lists the pages (any
   status). Blocking the delete was the other option; it was rejected as too strict for a POC.
3. **"Which pages use this file" is an on-demand scan** (`GET /media/:id/usage` →
   `ContentRepository.findReferencing`), using `strpos(blocks::text, …)` scoped by `site_id`. It
   matches the host-independent part, `/uploads/<siteId>/<filename>`. A usage table kept in sync on
   every content save was the alternative. The scan is always accurate and needs no new table; its
   cost grows with one site's page count, which is small here.

**Caching:** `/uploads` is served with `Cache-Control: public, max-age=0` plus an ETag (checked with
`curl`), so browsers revalidate and pick up a replaced file. The admin tab adds `?v=<timestamp>`
to its own previews after a replace, for display only. The stored URL never changes.

**Cost accepted:** the scan is a sequential read of that site's `content` rows on every detail-panel
open. A text match can also count a URL that appears in a page's text rather than as an image,
which errs towards warning. When `MED-01`'s thumbnails land (D-036 on that branch), replace must
also regenerate the thumbnail.
## D-043 — 2026-10-07 — Media thumbnails: one 400px WebP, stored URL, no backfill (`MED-01`)

**Decision:** every PNG, JPEG or WebP upload gets one thumbnail made with `sharp`
(`api/src/media/thumbnail.ts`): 400px wide, never enlarged, WebP at quality 80, EXIF rotation applied.
It sits next to the original as `<uuid>-thumb.webp`, and its URL is stored in a new nullable
`Media.thumbnailUrl` column. The `/media` grid and the editor's image picker show the thumbnail; the
picker still puts the original `url` into the page.

**Options the user chose between:**

- **Sizes:** one size, not several. The admin grid is the only consumer today. Responsive `srcset`
  sizes for public pages would be a separate change.
- **Where the URL lives:** a column, not a naming rule the client works out. Cost: a migration.
  Benefit: `null` says plainly "no thumbnail", so old uploads and SVGs need no special case.
- **Existing uploads:** no backfill. They have `thumbnailUrl = null` and the UI falls back to `url`.
- **SVG, GIF, video:** no thumbnail. SVG is already small and sharp at any size, a GIF would lose its
  animation, and video isn't an image. They keep `url` as their preview.

**Also (made during the build):** a PNG/JPEG/WebP that `sharp` can't decode is rejected with 400 and
nothing is written to disk. The mimetype is client-supplied, so this is the first real check that the
file is what it says. Images over 50 megapixels are rejected the same way (`limitInputPixels`), so a
small, highly-compressed file that claims huge dimensions can't eat the server's memory. Delete
removes the thumbnail file along with the original.

**Supersedes:** the "No thumbnails" part of D-025.

**Admin presentation:** previews sit on a transparency checkerboard (not flat grey), so a cut-out PNG
or logo shows its real edges; SVGs are shown whole with padding instead of cropped to fill the square;
GIF and SVG cards carry a small format tag; video cards show a play mark.
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
