# Worklog

Rolling status, **newest entry at top**. One entry per feature or meaningful chunk: what changed,
where, how it was verified, what is not done. Absolute dates only.

---

## 2026-10-09 — Start a page from a layout (`TYP-04`, built; review pending)

Decision in D-051.

- **API:** `POST /content` accepts `layout`; the server copies the blocks from `starter_layouts` (404 for an unknown
  key, 400 with blocks of its own), sanitised like any write. `api` 347 tests.
- **Admin:** the create screen shows Blank and the four layouts as radio cards (name, description, the blocks it
  holds); Article is preselected for a new Post. Light and dark styles. `admin` 99 tests.
- **Checked in the browser (scripted):** the five cards with their contents; choosing Landing made a page with exactly
  `hero, featureGrid, stats, testimonial, cta`; a new Post preselected Article and made `hero, richText, cta` at
  `/blog/harvest-diary`; an unknown layout is a 404 from the API.

**Not done:** reviewer and verifier pending; the picker hasn't been looked at visually.

---

## 2026-10-09 — Public pages for content types (`TYP-03` done)

Decision in D-050.

- **API:** migration `20261009150000_add_published_at`; `GET /public/sites/:sub/types/:prefix`; an `entry` block on
  a page that is an entry (author name only, visible fields shaped for display, media with the library's alt);
  publishing an entry refreshes its listing as well as its page. `api` 337 tests.
- **cms-blocks:** `EntryHeader`, `EntryList`, `entry.ts` (shapes and date formatting). **web:** the existing
  catch-all route renders them; the preview route shows the header too. `admin` 99 tests (render tests).
- **Checked with real screenshots** (headless Chrome, two hosts): the Corrick blog listing and a post with its
  featured image, excerpt, author and date; a talk entry with facts, a download, a button and a formatted-text
  body; a phone-width probe of both; Kestrel's `/blog` is its own empty listing, and Corrick's `/talks` and post
  are 404 on Kestrel's host. Two layout problems found and fixed from the first screenshots (an excerpt shown as a
  tiny fact row; an empty second column).

- **Review and verifier follow-ups:** long words no longer push the page wider than a phone; a listing's address is
  exact; a NUL character in a public address is a 404 (it was a 500); a file used only in an entry's field counts
  as "used on" it; an entry made only of fields can be published; `API_PUBLIC_URL` documented as a production
  requirement; a test that the public page serialises no email, ids or status. `api` 342 tests.

**Not done:** B-28. A second tenant's theme with entries hasn't been photographed.

---

## 2026-10-09 — Custom fields on content types (`TYP-02` done)

Decision in D-049.

- **API:** migration `20261009140000_add_type_fields` (fields on the type, values on the entry; built-in Posts
  gets excerpt and featured image); `field-definitions.ts` (six kinds, keys, normalising a field list) and
  `field-values.ts` (a Zod rule per kind, merge that keeps hidden values, required-field check); types accept a
  `fields` list; `PATCH /content/:slug` accepts `data`; publishing needs the required fields; duplicates copy
  values. `api` 294 tests.
- **Admin:** a field builder in the type form (name, kind, needed, choices, up/down, remove; kind locked once
  saved), the entry's fields in the editor's side panel built per type, media and date fields, the picker shows
  documents, blocks and values saved by separate requests with a named error, Back goes to the entry's type.
  `admin` 89 tests.
- **Checked on the live API and in the browser (scripted):** a type created with all six kinds; a seventh kind
  refused; bad values listed together; rich text cleaned; a required field blocking publish with 422. In the
  editor: the builder loaded the six saved fields with kinds locked and saved a new "Level" choice; the entry's
  panel showed every field with saved values; typing a name and a date autosaved; a `javascript:` link showed
  "Fields not saved: Register: A link must start with ..." and recovered when fixed.

- **Review and verifier follow-ups (all fixed, with tests):** media accepted any string containing the site's
  upload path, including `javascript:` addresses; now only `/uploads/<site>/<file>` is accepted and stored in
  that short form. A NUL character in formatted text, a link or a choice option gave a 500. A removed field's
  name re-added as a different kind inherited its old values (removed fields are now kept hidden in the list so
  a key is never reused across kinds). The form could overwrite another admin's new field with a stale list (it
  sends fields only when changed). The address change runs first. A live entry can't have a needed field
  emptied. Empty paragraphs and links with no address no longer count as filled. `api` 322 tests, `admin` 89.

**Not done:** B-27. The screens haven't been looked at visually (the browser pane would not render
screenshots). General-purpose agents again did the review and verification.

---

## 2026-10-09 — Content types and typed entries (`TYP-01` done)

Decision in D-048.

- **API:** migration `20261009130000_add_content_types` (no drift, tested on a copy of the dev database: the
  existing site got Posts); `/content-types` (list for `content:read`, create, rename, delete for
  `site:manage`); prefix rules in `api/src/content-types/prefix.ts`; `content` list/create/duplicate are
  type-aware and record the author; pages can't take a type's address. `api` 234 tests.
- **Admin:** a Types screen (list with address and entry count, add/edit form with suggested singular name and
  address and a live example of the public address, delete with reasons when locked), a shared context so the
  sidebar gets a new type at once, and `/content/:prefix` (+ `/new`) which are the Pages screens for a type.
  `admin` 89 tests, light and dark styles.
- **Checked in the browser (scripted, the pane was hidden):** adding "Case studies" filled in "Case study" and
  `/case-studies`, joined the sidebar with no reload, and an entry made from its screen opened in the editor at
  `/case-studies/harbour-restoration`; it is absent from Pages. A type with entries has its address locked and
  Delete disabled; an empty type deletes and leaves the menu at once; a reserved address shows the API's message.

- **Review follow-ups:** an address change is one atomic statement (an entry created in between used to be
  stranded under the old address); unique and foreign-key violations from races answer 409 instead of 500;
  `?type=a&type=b` is a 400; more reserved words; an uppercase address is refused, not silently lowercased;
  a failed sidebar reload keeps the old list; `/types` shows a message to people who can't manage types.
  `api` 241 tests, `admin` 89. The verifier passed every item with two tenants and every role.

**Not done:** B-26. The new screens haven't been looked at visually (the browser pane would not render
screenshots, so they were checked by scripted interaction and page text). The built-in `reviewer`/`verifier`
agents were again replaced by general-purpose ones.

---

## 2026-10-09 — Media documents, alt text, title and description (`MED-04` done)

Decision in D-047.

- **API:** PDF, Word and Excel upload (and replace) with a first-bytes check, `nosniff` on `/uploads`;
  `alt`, `title`, `description` on `media` (migration `20261009120000_add_media_details`, no drift);
  `PATCH /media/:id`; a new file's title starts as its upload name; changing alt text refreshes the live
  pages that use the file. The live site fills an empty image alt from the library
  (`api/src/public/image-alt.ts`), without touching the stored page.
- **Admin:** document tiles in the grid (type spelled out, colour only groups), a large tile with "Open
  file" in the panel, a Details form (alt for images only, title, description) with Save and status,
  human type names. The editor's image upload and the picker stay images only. Light and dark mode.
- **Verified:** `api` 149 tests, `admin` 69, builds clean. In a real browser: document tiles, the panel,
  typing alt text and a title and saving (API has the values). Live site: the image with no alt of its own
  rendered the library text, the one with typed text kept it, and the stored page still has the empty alt.
  A "PDF" that is really a web page was refused; the three real documents were stored; files are served
  with `nosniff`.
- **Found by looking:** my first form was unreadable in dark mode, and the close button hid behind a
  document tile; both fixed.

- **Review follow-ups:** live-page refresh in parallel batches of 10 (it was one by one, up to 2 s each); a
  NUL character in a title or description no longer gives a 500; closing the panel over unsaved text
  asks first; a replace no longer overwrites freshly saved details in the panel; direction-override
  characters and half-cut emoji handled in titles; "Open file" cache-busts after a replace; library alt
  text used for the grid images' own alt. `api` 166 tests, `admin` 69.
- **Verifier:** every item passed, including the second tenant getting 404 on every media route, and a live
  check that an alt change calls the refresh for each published page that uses the file.

**Not done:** picking a document into a page (`TYP-02`'s media field); B-25 (a "decorative image" switch;
Office files with no type from the operating system). The built-in `reviewer` and `verifier` agents refused to
run without the `/build` kit docs again; general-purpose agents did both.

---

## 2026-10-09 — Edit text in place on the canvas (`BLK-07` done)

Decision in D-046; follows D-045.

- **In-place editing:** `contentEditable: true` on every top-level text, textarea and rich-text field
  (29 fields, 15 blocks), except the form's submit label and the video link. Puck swaps each for an
  editable span inside the block's own heading or paragraph; typing writes the same prop as the sidebar
  field. No `Editable` primitive was built. Text inside lists and button labels stay sidebar-only.
- **Floating menu on the canvas:** `RichTextInlineMenu` (same controls as the sidebar toolbar, one shared
  component, no underline). Both menus carry `data-puck-rte-menu`, without which Puck ended the editing
  session as soon as the link box took focus.
- **Public site:** `Prose` and the testimonial quote use `whitespace-pre-line`, so a line break typed in a
  plain-text field shows on the live page as it does in the editor. The video embed's iframe `title`
  ignores non-string values.
- **Tests:** `config.test.ts` (every text field is editable or on a reasoned exception list; the list can't
  go stale) and `inline-render.test.ts` (every block renders with editable nodes: no throw, no
  `[object Object]`, every editable value drawn). Both were shown to fail when the thing they guard breaks.
  `admin` 66 tests, `api` 105, builds clean.
- **Checked by hand with real clicks and typing:** Hero headline and testimonial quote (canvas text and
  sidebar field identical, autosave stored it, survives a reload); bold and italic from the floating
  menu; a link added from the floating menu (`<a href="https://example.com/brave">`, menu stays open, no
  reload). The verifier also built `web` for production and confirmed the public HTML has no editor
  markup.

**Not done:** B-24, the canvas shows blank structure for empty text that the public site doesn't, and an
empty field can't be clicked, so it is refilled from the sidebar. Image alt text and captions are
sidebar-only. The built-in `reviewer` and `verifier` agents refused to run for this ticket (they need the
`/build` kit's `docs/plan.md` and `docs/use-cases.md`); general-purpose agents did both jobs.

---

## 2026-10-09 — Rich text: editor, toolbar, sanitising on write, shared typography (`BLK-05` done)

Decision and costs in D-045.

- **Editor:** Puck's built-in `richtext` field on the RichText block, storing the same HTML in the same
  `html` prop. Custom toolbar (`admin/src/components/RichTextToolbar.tsx`): paragraph / heading /
  subheading, bold, italic, bulleted and numbered lists, quote, link. Links are plain (no `target`,
  no `nofollow`). `admin/src/lib/richTextLink.ts` validates link addresses.
- **API:** `api/src/content/sanitize.ts` (`sanitize-html`) on create, update and duplicate; a
  non-string `html` is refused with 400. Runs before the publish checks.
- **Typography:** headings, lists, quotes and links styled in `cms-blocks/src/RichText.tsx` from
  `--site-*` variables only, so the canvas matches the public site. The old rules in `web`'s
  `globals.css` are gone.
- **Verified:** `api` 105 tests, `admin` 47, typecheck and lint clean; `cms-blocks` and `web` build. In a
  real browser: toolbar buttons, the link box (hint with nothing selected, refusal of `javascript:` and
  `//host`, Apply, Remove, Escape returning focus), autosave, no page reload. Against the live API a
  malicious payload (script, `onclick`, `javascript:` link, `<img onerror>`, `target`) came back clean;
  `web` served the stored HTML as-is (checked with `curl` and a headless Chrome screenshot).
- **Review:** the verifier found that after a refused link the next closing tag became `</span>`
  (a sanitize-html 2.18 quirk with function-form `transformTags`); fixed with a text unwrap and 6
  regression tests. The review found no XSS and no write path that skips the sanitiser.

**Not done:** B-22 (older rows aren't re-sanitised) and B-23 (unsupported tags and `tel:` links are
dropped, not converted). Inline editing on the canvas is `BLK-07`; the floating menu there still uses
Puck's default. The built-in `reviewer` agent refused to run without the `/build` kit's
`docs/plan.md` and `docs/use-cases.md`, so a general-purpose agent reviewed instead.

---

## 2026-10-09 — Week-3 merge: seven finished branches brought onto one base

Merged into `claude/week-3-tickets-review-b9d261`, in this order: week-2 tickets, `BLK-02`, `BLK-03`
tests, `BLK-04`, `MED-01`, `MED-02`, `BLK-06`. Plan: `docs/WEEK3_PLAN.md`.

- **Renumbered** clashing IDs: `BLK-02` D-033 → D-040, `BLK-03` D-034 → D-041, `BLK-06` D-034 → D-042,
  `MED-01` D-036 → D-043, `MED-02` D-037 → D-044. Backlog: `BLK-02`'s B-16 → B-19, `BLK-04`'s B-17 → B-20
  (its B-16 was the same item as the week-2 B-16), `BLK-06`'s B-16 → B-21.
- **Integration fixes** the branches couldn't have known about: replace-in-place now regenerates the
  thumbnail (`MED-01` x `MED-02`); `CNT-12`'s publish checks got a rule for `videoEmbed` (`BLK-02`
  added a 15th block after they were written); `MediaPage.tsx`, `config.tsx`, `public.service.ts` and
  `schema.prisma` merged by hand.
- **Verified:** `api` typecheck, lint and 69 tests; `admin` typecheck, 26 tests and build; `cms-blocks`
  and `web` build; all migrations apply in order on an empty database with no drift from the schema.

**Not done:** not run in a browser yet, and `api/test/submissions.e2e-spec.ts` (needs a running
database) wasn't run. `BLK-06` split out a new ticket, `BLK-08` (submission status and notes), which
`WEEK3_PLAN.md` doesn't schedule yet.

---

## 2026-10-06 — Contact form submissions work end to end (`BLK-06`, D-042)

**What changed**
- `api`: `submissions` table (migration `20261006164148_add_submissions`), `SubmissionRepository`
  (every method takes `siteId`), `POST /public/sites/:subdomain/submissions` behind
  `FormSecretGuard`, and `GET /submissions`, `GET /submissions/:id` behind a new
  `submissions:read` permission (Owner, Administrator, Editor).
- `cms-blocks`: `ContactForm` really submits now, through a `ContactFormProvider`; it has a
  honeypot field and sending, sent and error states. With no provider (the editor canvas) it shows
  a preview note instead. `BlockRenderer` passes `index` to every block.
- `web`: `src/site/contactFormAction.ts` server action, which resolves the site from the host,
  applies the rate limit (5/min per IP, `src/lib/rateLimit.ts`) and the honeypot, then forwards
  with the shared secret. The page wraps its blocks in `ContactFormProvider`.
- `admin`: Submissions nav item, list page (`/submissions`) and detail page (`/submissions/:id`).
- Pagination: `GET /submissions` returns `{ items, nextCursor, total }`, 50 per page, newest first;
  `?after=<id>` gets the next page, and the cursor id is looked up within the caller's site only.
  Admin shows "Showing N of M" and a "Load more" button.
- New env var `FORM_SUBMIT_SECRET`, same value in `api/.env` and `web/.env.local`.

**Verified**
- `api` e2e, `test/submissions.e2e-spec.ts` (7 tests, two sites): no or wrong secret gives 403;
  a valid submission is stored with labels in field order and extra keys dropped; a missing
  required field or bad email gives 400; a non-form block gives 400; a draft page or unknown site
  gives 404; each owner sees only their own site's list; site B can't open site A's submission by
  id (404); a Contributor gets 403; 56 submissions page as 50 + 6 with no duplicates, and site B's id
  as a cursor gives 400.
- Headless Chrome on `corrick.lvh.me` and `harbour.lvh.me`: real submissions were stored under the
  right site. A filled honeypot showed "sent" and stored nothing. With the browser's `required`
  stripped, the server refused the missing name. The 6th submission within a minute was refused.
  The honeypot field is not visible.
- Admin in the browser: the list shows only Corrick's submissions; the detail view keeps line
  breaks; with 65 submissions, "Load more" goes from 50 to 65 unique rows and then disappears. In the editor canvas the form shows the preview note and stays usable.
- `api` typecheck, lint and tests; `web` typecheck, lint and `next build`; `admin` typecheck and
  build. All pass.

**Found while verifying:** `next dev` passes a client-sent `X-Forwarded-For` straight through, so
locally the rate limit can be dodged by faking it. Production depends on nginx overwriting that
header; this is now a DoD item on `DEP-01a`.

**Not done**
- Status and internal notes are `BLK-08`. Delete, email alerts and CSV export are B-16.
- The honeypot and rate limit have no automated tests (`web` has no test runner); both were
  verified by hand in headless Chrome, twice.

**Editor follow-up (user feedback, same day):** in the sidebar, each form field now shows its label
instead of "Item #0" (Puck `getItemSummary`), and **label** comes before **name**. Name is now
optional: on save, `resolveContactFieldNames` (cms-blocks) builds an empty name from the label
("Phone number" → `phone_number`) and numbers repeats (`phone_2`). Before this, a nameless field
made the live form fail with "This form has changed". Verified in the browser: I added a field with
only a label, it saved as `phone_number`, and a live submission stored the phone answer.

**Review:** reviewer APPROVED; verifier PASS on every DoD item. Both ran as general agents with the
kit's reviewer/verifier instructions (the kit's own agents need `docs/plan.md` and `docs/use-cases.md`). One
minor bug from the review is fixed: a form field named `constructor` read `Object.prototype` and
crashed the submit with a 500. It now uses `Object.hasOwn`, with an e2e test. Not acted on: with no
`X-Forwarded-For` at all, every visitor shares one rate-limit bucket. Production nginx always sets
it (`DEP-01a`).
## 2026-10-07 — Media replace-in-place and "used on" delete warning (`MED-02` done)

The two open `MED-02` items, built after confirming three choices with the owner (D-044).

- **API**: `PUT /media/:id` (`content:write`) replaces a file's bytes and keeps its URL. It accepts
  the same mimetype only and returns 400 otherwise. The new bytes go to a temp file that is renamed
  over the original, and a failed write cleans up the temp file. If a Delete lands mid-replace, the
  file is removed and the call returns 404. `GET /media/:id/usage` (`content:read`) lists pages of
  any status whose blocks mention `/uploads/<siteId>/<filename>`, using
  `ContentRepository.findReferencing`, a site-scoped `strpos(blocks::text, …)` raw query.
- **Admin `/media`**: the detail panel shows "Used on" and has a "Replace file" button (its picker
  is limited to the same type). The Delete confirm lists the pages using the file and still allows
  the delete. After a replace, previews add `?v=` so this tab refetches. The stored URL is unchanged.
- **Merge fix (2026-10-09)**: `MED-01` and `MED-02` were built in parallel, so replace left the old
  thumbnail in place. `replace()` now regenerates it (400 on an undecodable image, same as upload) and
  `updateSize` also stores `thumbnailUrl`. Three tests in `media.service.spec.ts`.
- Tests: `media.service.spec.ts` (6 tests). API 12/12 pass; typecheck and oxlint are clean in both
  repos.
- Verified live with a throwaway API on `:4012` and admin on `:5184`, against the local DB:
  - Replace kept the URL and the served bytes changed (sha matched the new file).
  - A JPEG for a PNG got 400, and an unknown id got 404.
  - Usage found a draft page.
  - `/uploads` sends `Cache-Control: max-age=0` with an ETag.
  - In the browser, the preview swapped, a wrong type was refused, and the Delete confirm listed
    the page.
  - The test page and file were deleted afterwards.
- A general-purpose reviewer and verifier ran; the project kit's own agents refused because there
  is no `docs/plan.md`. The verifier passed every DoD item. The reviewer's three fixes are applied:
  a stale panel reopening after a replace, a leftover `.tmp`, and the replace/delete race.

**Not done / known gaps:**
- Other admin surfaces (the media picker, `ImageUploadField`, the editor canvas) can show the old
  image in the same tab until a reload.
- "Used on" refreshes only when the panel is reopened.
- When `MED-01` thumbnails land (that branch's D-036), replace must regenerate the thumbnail too.
- While stopping a test server, I killed the main `:4001` API and the `blk-02` worktree's `:4002`
  API by mistake. Both were restarted and are healthy.
## 2026-10-07 — Media thumbnails with `sharp` (`MED-01`)

Uploads now get a small preview, and the media library shows it. Decision in D-043.

- `api`: new `src/media/thumbnail.ts` (`makeThumbnail`), called from `MediaService.store` before
  anything is written. PNG/JPEG/WebP → 400px-wide WebP at `<uuid>-thumb.webp`; SVG/GIF/video → none.
  Undecodable images, or images over 50 MP, → 400. `remove` deletes the thumbnail too. New nullable `Media.thumbnailUrl`
  (migration `20261007090742_add_media_thumbnail`), returned by `GET /media` and `POST /media`.
  `sharp` added as a dependency.
- `admin`: `mediaApi.ts` gains `thumbnailUrl`, `previewUrl()` and `formatBadge()`. `MediaPage` grid
  and `MediaLibraryModal` show the thumbnail (fallback `url`), on a transparency checkerboard; SVGs
  are contained not cropped; GIF/SVG get a format tag; video gets a play mark; cards show file size
  and a visible keyboard focus ring. Fixed a sizing bug where a large original stretched its card.
- Tests: `thumbnail.spec.ts` (10 cases): size/format for each raster type, no enlarging, null for
  SVG/GIF/video, rejection of fake image bytes and of a 50.4 MP image. `npm test` 16/16, lint and
  both typechecks clean.
- Reviewer (general-purpose agent; the kit's `reviewer`/`verifier` refuse to run without
  `docs/plan.md`) asked for the pixel limit, now added. Verifier passed both open DoD items with its
  own uploads, then deleted them.
- Verified live, API on `:4011`, admin on `:5183`: JPEG 2400×1600 → 400×267 WebP (40 KB → 2 KB);
  PNG thumbnailed; SVG `thumbnailUrl: null`; fake PNG → 400 with nothing on disk; delete removed
  original and thumbnail. Grid checked in light and dark.

**Not done:** no backfill for files uploaded before today (they show the original). Public pages
still serve originals; responsive image sizes there would be new work.
## 2026-10-06 — BLK-04: settings panel labels, checked in the browser

`admin/src/puck/config.tsx`: every field, block and list now has a human label (`Primary button`,
`Link (URL or /path)`, `Call to action`, `FAQ`), and every list has a `getItemSummary`, so collapsed
items read "Farms" / "Wholesale" instead of "Item 1". `linkField`/`imageField` became small
functions taking the label.

Verified in the in-app browser against a worktree API on :4011 and admin on :5175, on a draft page
`blk04-settings-test` seeded with all 14 blocks: text, textarea, radio, yes/no radio, link object,
image URL, list and list-inside-a-list all update the canvas live and survive a reload in the stored
`cms-blocks` shape. Typecheck, lint and build pass.

**Not done:** a person hasn't checked it by hand. Drag-from-drawer doesn't register with synthetic
pointer events (BLK-03). Canvas theme is still hard-coded (B-16); Puck's page `title` field is a
no-op (B-20).
## 2026-10-06 — Persistence tests for the editor canvas (`BLK-03`)

`admin` now has a test runner (vitest, D-041) and its first test file,
`admin/src/lib/contentApi.test.ts`: 26 tests that save and reload each canvas action (add,
add-in-the-middle, delete, delete-last, reorder, swap two of the same type, duplicate, edit a
duplicate, publish, PricingTable features, all 14 type names) through the real
`saveDraft`/`publishPage`/`getPage`, with `fetch` swapped for an in-memory API.

- Verified: `npm test` 26/26; `npm run typecheck` and oxlint clean. Each test group was confirmed to
  fail when `contentApi.ts` was deliberately broken (every block given the same id → 2 fail; blocks
  saved in reverse → 7 fail; Puck ids leaked into storage → 18 fail), then restored.

- Then driven in real Chrome (headless, trusted mouse input via the DevTools protocol) against the
  running api/admin on a throwaway page `blk-03-canvas-test` in the shared `cms` DB: dragged Hero,
  RichText, Faq in from the sidebar; duplicated Hero; deleted RichText; dragged Faq to the top;
  reloaded; published. Canvas and `GET /content/:slug` matched after every step — final
  `[faq, hero, hero]`, 3 unique ids, `published`. The earlier "drag can't be tested headlessly" was
  only true of synthetic JS events and one-jump drags; see the new gotcha in `CLAUDE.md`.

**Not done:** the user's own hands-on pass in a browser (BLK-03 DoD). (Test page
`blk-03-canvas-test` deleted from the `cms` DB afterwards.) No API e2e test for block order (the API
stores the array as-is in JSONB). The CDP drive script lives in the session scratchpad, not the repo.
## 2026-10-06 — Video embed block; unknown block types no longer 500 a page (`BLK-02` done)

New `videoEmbed` block (YouTube/Vimeo by pasted link). Decision and alternatives in `DECISIONS.md` D-040.

- `cms-blocks`: `VideoEmbedBlock` in `types.ts`; `video.ts` (`parseVideoUrl`, `videoEmbedSrc`);
  `VideoEmbed.tsx`; registered as "Video". No hex colours (grep clean).
- `admin`: Puck `VideoEmbed` component with heading / link / caption fields and an editor-only
  placeholder for an empty or unsupported link. `contentApi.ts` derives `provider` + `videoId` from
  `url` on save and drops them on load.
- **Bug fix found on the way:** `getBlockComponent` threw on a block type the running build doesn't
  know, so the page 500'd — despite `BlockRenderer`'s comment saying it skips them. Reproduced against
  the main checkout's `web` (old `cms-blocks`, page containing a `videoEmbed`) → 500. Now returns
  `undefined` and the block is skipped. Matters on every new block type: stored JSON can be newer than
  a not-yet-redeployed `web`.

**Verified** (this worktree's api/web/admin on ports 4002/3100/5174, shared `cms` DB, throwaway
`video-test` page created then archived and deleted):
- Parser, run against the built `dist`: `watch?v=`, `youtu.be` (with/without scheme, with `?t=`),
  `m.`, `/shorts/`, `/embed/`, `/live/`, `vimeo.com/N`, `player.vimeo.com/video/N` → parsed.
  `evil-youtube.com`, `youtube.com.evil.com`, `javascript:`, `ftp:`, short IDs, channel URLs, an ID
  with `"><script>` appended → null. Tampered stored IDs (`x" onload=…`, `../../evil.com/…`,
  unknown provider) → no iframe src.
- Public site (curl + headless Chrome screenshot of `umair.lvh.me:3100/video-test`): YouTube block
  with heading + caption and a Vimeo block render as themed 16:9 iframes; the tampered block renders
  nothing; the FAQ after it still renders. An unknown `notARealBlock` → page 200, rest renders.
- Editor (browser pane): existing video blocks load; the tampered block shows the "isn't a YouTube
  or Vimeo video" placeholder; typing a YouTube link swaps in the player and autosave stored the
  re-parsed `provider` + `videoId` (overwriting the tampered ID); a lookalike-domain link stored with
  neither.
- `admin` + `web` typecheck and lint clean; `cms-blocks` typecheck + build clean.

**Not done / not verified**
- Dragging a *new* Video block in from the picker — the browser pane's synthetic drag doesn't trigger
  Puck's drop (same limitation as every earlier editor entry). Editing an existing one was verified.
- Start time, unlisted Vimeo (`?h=`), other providers — see D-040 "Not covered".
- Note: the seeded site's subdomain is currently `umair`, not `corrick` (renamed via Settings, D-031),
  so `corrick.lvh.me` 404s locally.
## 2026-10-07 — Public pages cached with ISR, refreshed on publish (`CNT-08` done)

`web`'s tenant route is now ISR, and `api` tells `web` exactly which site and path to refresh when a
live page changes: publish, unpublish, archive, or saving a live page (D-039). The 60 s timer is the
backstop for theme and subdomain changes (the user's call) and for a refresh that never arrived.

- `api`: `src/revalidation/` (`RevalidationService`: 2 s timeout, never throws, logs on failure),
  called from `ContentService.update` when the page was live before or after the write. Needs
  `WEB_REVALIDATE_URL` + `REVALIDATE_SECRET`.
- `web`: `revalidate = 60` + empty `generateStaticParams` on the page route, with fetches cached. The
  proxy maps `/__revalidate` to `app/internal/revalidate/route.ts` (timing-safe secret check). The
  proxy's branches were tidied in the same pass.
- Verified on `next build && next start` (dev mode has no ISR). Pages go MISS then HIT. A direct DB
  edit stays hidden while an API save shows on the next request. Publish, unpublish and archive show
  at once. Same path on both tenants gives separate entries, and refreshing one leaves the other HIT.
  With web down, a publish still returns 200 and the page catches up within 60 s.

**Not done:** anyone can fill the cache with 404s (`B-17`), and `/__revalidate` should be blocked
in nginx (`B-18`). Both are for deploy.

---

## 2026-10-07 — Four starter layouts as data (`TYP-05` done)

`starter_layouts`, one global table with no `siteId` (D-038), is seeded from `api/prisma/starter-layouts.ts`:
Landing, About, Contact, Article, all with generic placeholder copy and no images. `GET /starter-layouts`
(`content:write`) is ready for `TYP-04`.

- Verified on `cms_week2`: re-seeding keeps 4 rows. A page made from each layout publishes (200) and
  renders on `kestrel.lvh.me`. Tests hold every layout to registry block types and to passing the
  publish checks with no warnings.
- Review follow-ups: grids filled to 4 items, and placeholder figures set to `00`.

**Not done:** the create-page picker (`TYP-04`). The Contact layout's form has no submit endpoint (`BLK-06`).

---

## 2026-10-07 — Shareable preview links (`CNT-09` done)

One unguessable link per page, with no expiry, until someone turns it off (D-037, the user's choice
over a signed expiring token).

- `api`: `preview_links` (unique per page; cascades from both content and site),
  `PreviewLinkRepository` (all lookups site-scoped), `GET/POST/DELETE /content/:slug/preview-link`,
  and the public `GET /public/sites/:sub/preview/:token` (`no-store`, `noindex`).
- `web`: `src/proxy.ts` sends `/__preview/<token>` to a `force-dynamic` route. It renders the site's
  own chrome with a "Private preview" strip (new `banner` slot on `SiteChrome`), plus `noindex` and
  `no-referrer`.
- `admin`: a "Share preview" popover in the editor top bar to create, copy, open and turn off the link.
- Verified: a token only works on its own host; drafts stay 404 at their real path; a link still
  works after publish; archived pages give 404 (and a link can't be created for them, 409); the link
  dies once revoked. Popover checked in light and dark mode.

**Gotcha found:** `cms_week2` (copied from `cms`) already had MED-01's `add_media_thumbnail` migration
applied, which this branch lacks, so `prisma migrate dev` wanted to reset the DB. Both migrations here
were hand-written, checked with `prisma migrate diff` against a throwaway shadow DB (empty diff), and
applied with `migrate deploy`.

---

## 2026-10-07 — Pre-publish checks (`CNT-12` done)

Any `PATCH` to `published` is refused with 422 and a list of problems per block (D-036). The rules
live once, in `api/src/content/publish-checks.ts`. Errors: no blocks, blank required text, a
half-filled or missing required link, a missing required image, an empty list, a blank pricing
feature, duplicate form-field names, an unknown block type. Missing alt text only warns.

- `GET /content/:slug/checks`. The editor now saves, then checks, then publishes, with "Publish
  anyway" for warnings only. The Pages-list status dropdown shows a refused publish with
  "Fix in editor". Both use `PublishChecksPanel`.
- A drift test reads `cms-blocks/src/types.ts` and fails if a block type has no rule.
- The review found `cms-blocks` drew blank optional links/images (TeamGrid's default photo) as an
  empty button or a broken frame. `hasLink`/`hasImage` now treat blank as absent.
- Also fixed in passing: the editor top bar hard-coded "Corrick Oyster Co.".

**Not done:** autosaves of a live page are deliberately not checked (D-036). Clicking a problem
doesn't select its block. The editor canvas still uses Corrick's theme for every site (`B-16`).

---

## 2026-10-07 — Duplicate a page (`CNT-10` done)

`POST /content/:slug/duplicate` makes `<slug>-copy` (`-copy-2`, …) under the same parent, always as
a draft, with ` (copy)` added to the title. Archived pages can't be copied (409), because that would
restore them without `content:delete`. The Pages list's Duplicate row action adds the copy to the top
with a highlight and an "Open in editor" notice. Checked in the browser in light and dark mode.

---

## 2026-10-07 — Second tenant: Kestrel Rigging (`GOV-08a` done)

`api/prisma/seed.ts` now seeds two sites through one `seedSite(spec)`. Kestrel (`kestrel`, owner
`owner@kestrel.test`, the dark technical theme from `f161fd8`) gets Home and Capability (published)
and Method statements (draft). Verified: re-running the seed changes nothing. Each host serves only
its own pages and theme. Cross-tenant `GET`/`PATCH /content/:slug` gives 404 both ways.

**How week 2 was run:** in worktree `week-2-tickets-review-936c71`, against a DB copy `cms_week2`
(API :4021, web :3020, admin :5183), so the shared `cms` DB and the other sessions' servers were never
touched. Every ticket had a reviewer and a verifier agent. The kit's own `reviewer`/`verifier` agent
types refuse to run without `docs/plan.md`, so general-purpose agents did both roles.

---

## 2026-10-06 — In-memory subdomain → site cache in `api` (`FND-04` done)

Public page views no longer look the site up in Postgres every time. Decision in D-035.

- New `api/src/sites/subdomain-cache.ts` (`SubdomainCache`, provided and exported by `SitesModule`).
  It caches `subdomain → siteId` only, with a 5-minute TTL as a safety net, and never caches misses.
  A generation counter stops an in-flight lookup from re-adding a name that was just renamed away.
- `PublicService` resolves through the cache: `getPage` now needs no site query once warm. `getSite`
  still reads name and theme fresh with `findById`.
- `SitesService.updateSubdomain` invalidates the old subdomain after the write.
- Tests: `subdomain-cache.spec.ts` (5 tests) covers hit, case-insensitivity, no miss caching, TTL
  expiry, the in-flight race, and rename → old null / new resolves. `npm test`, typecheck and lint
  all clean.
- Verified live against a copy of the DB (`cms_fnd04`, dropped afterwards), API on `:4011`, with
  Postgres statement logging on that copy only: 10 cold page views → 1 `sites` query; 10
  unknown-subdomain requests → 10 (not cached); `PATCH /sites/:id/subdomain` corrick → corrick-farm
  gave `corrick` 404 and `corrick-farm` 200 straight away. Renamed back afterwards.

**Not done:** built without `/build`, so no reviewer or verifier agent ran. The `BLK-06` worktree
has uncommitted edits to `api/src/public/public.service.ts` (`submit` calls `findSite`, which is now
`findSiteId`), so expect a small merge conflict there. Both `BLK-03` and `BLK-06` branches claim
D-034, which is why this entry is D-035.

---

## 2026-10-06 — Tickets split into `tickets/`, one file each

Created `tickets/` in the workflow kit's layout (D-033): `STATUS.md` plus one `<ID>.md` per ticket,
54 in total (13 DONE, 7 IN-PROGRESS, 33 TODO, 1 BACKLOG), ordered by week so each ticket follows
what it depends on.

- Kept the existing IDs (`CNT-07.md`), not `T-001`.
- `STATUS.md` is now the only place status lives. `EXECUTION_PLAN.md`'s ticket tables lost their
  Status column; the per-row status notes moved into each ticket's "History" section.
- Done tickets list what was built and verified; open tickets have a drafted Definition of Done,
  every item marked **Draft**.

**Not done:** no `docs/use-cases.md` or `docs/plan.md`, so the DoD isn't from use cases and
`/build`'s pre-checks will stop. The published plan's original acceptance criteria couldn't be read
(not shared with this account), so drafts may differ from what was agreed there.

---

## 2026-10-06 — Status dropdown on the Pages list; restore for archived pages (`CNT-11` done)

Per-row Archive button replaced by a status dropdown that lists every status except the current one.
`archived` became a real `ContentStatus` value (D-032, supersedes D-029's flag).

- `api/prisma/schema.prisma`: `ContentStatus` + `archived`. Two migrations —
  `20261006140000_add_archived_content_status` (enum value) and
  `20261006140100_backfill_archived_content_status` (`archived_at IS NOT NULL` → `status = archived`).
- `ContentRepository`: list filters on `status` instead of `archivedAt`; `archive()` removed.
- `ContentService.update`: entering/leaving `archived` needs `content:delete`, sets/clears
  `archivedAt`. `ContentService.archive` and `PATCH /content/:slug/archive` removed. `remove` now
  guards on `status !== 'archived'`. DTO accepts `archived`.
- `admin`: `setPageStatus(slug, status)` replaces `archivePage`; `Select` gained a `placeholder` prop
  (shown when the value isn't among the options); `roles.ts` gained `canPublishContent` /
  `canArchiveContent`. `PagesListPage` rows use the dropdown on both tabs; archiving still asks to
  confirm; Delete Permanently stays a separate button on the Archived tab. `.pages-table` dropped
  `overflow: hidden` (it clipped the last row's popup) — corner cells are rounded instead.
- Verified against a copy of the DB (`cms_cnt11`, so the shared `cms` DB wasn't touched): backfill
  converted the existing archived page; curl confirmed archive sets `archivedAt`, restore clears it,
  `DELETE` on an active page → 409, unknown status → 400, and as an Author archive/restore → 403
  while publish → 200. In the browser: dropdown hides the current status on every row, last-row
  popup isn't clipped, publish updates the badge in place, archive confirms and moves the row to
  Archived, restore to Draft moves it back. Checked in dark and light mode.
- Merged with `CNT-07`: its `ContentRepository.findLiveByPath` dropped the `archivedAt: null`
  condition — `status: 'published'` alone now excludes archived pages.

---

## 2026-10-06 — Public site from the database, by subdomain (`CNT-07`)

The public site now renders real pages from Postgres. Each tenant is reached on its own subdomain,
locally `http://corrick.lvh.me:3000`. Decisions in `DECISIONS.md` D-030 (approach) and D-031
(editable subdomains, folded into this ticket).

- **`api`:** `sites.subdomain` (unique) via migration `20261006120000_add_site_subdomain`, which
  backfills existing rows from the first label of `host`. New `SitesModule`: `GET /sites/:siteId` and
  `PATCH /sites/:siteId/subdomain` (new `site:manage` permission, Owner/Administrator). New
  unauthenticated `PublicModule`: `GET /public/sites/:subdomain` and `.../page?path=`.
  `ContentRepository.findLiveByPath` is the only public read: published and not archived. Session
  memberships now carry `siteSubdomain`. Seed sets `subdomain: 'corrick'`.
- **`web`:** `src/proxy.ts` (Next 16's name for middleware) rewrites the host's subdomain into
  `/sites/[subdomain]/[[...path]]`. `layout.tsx` loads the site, `page.tsx` the page. Two 404 pages:
  `app/not-found.tsx` for an unknown site, `app/sites/[subdomain]/not-found.tsx` (site-themed) for
  a missing, draft or archived page. `SiteChrome` now wraps `children` instead of taking a fixture.
  Deleted `src/fixtures/`, `/preview/[site]` and the `/` comparison view (B-07). `next.config.ts`
  allows `*.lvh.me` as a dev origin.
- **`admin`:** Settings has a real **Site Address** card (rename with confirm, API errors shown
  inline, read-only below Administrator). Every "View"/"Visit" link builds from
  `VITE_SITE_URL_TEMPLATE` plus the session's subdomain. `RequireAuth` now refreshes the stored
  session from `/auth/me`, so a session saved before this change picks up `siteSubdomain`.

**Verified, not assumed:**
- **API (curl):** home → 200. A draft page, an archived-but-published page and a nonexistent path
  return identical 404s. Unknown subdomain → 404. Rename: bad format and reserved names → 400,
  taken → 409, no token → 401, Editor → 403, Administrator and Owner → 200. After a rename the old
  name → 404 and the new one → 200.
- **`web` (curl with `Host` headers):** the right status for each of `corrick.`, `CORRICK.`,
  `nope.`, bare `lvh.me`, `127.0.0.1`, `a.b.lvh.me`, and direct `/sites/corrick`.
- **Visual (headless Chrome screenshots):** themed home page, themed page-404, and the platform
  site-404. Caught and fixed a dark band under the footer on short pages: `SiteChrome` needed
  `min-h-screen`.
- **`admin` (in the browser pane):** a reserved name shows the inline error; a real rename to
  `corrick-oysters` updated the confirm text, the success note, the stored session and the Pages
  "View" links, and the public site followed.
- **Checks:** `api`, `web` and `admin` typecheck and lint clean (3 pre-existing `admin` lint
  warnings in untouched files).
- **Cleanup:** subdomain renamed back to `corrick` and both test pages deleted; `psql` confirms the
  DB is back to one site with one Home page.

**Not done:**
- No caching (`CNT-08`), and no in-memory site-lookup cache (`FND-04` stays in progress).
- Header and footer show only the site name: nav, tagline and footer links aren't stored yet
  (`GOV-04`).
- Only one tenant exists, so web invariant 4 ("test with two hosts") is checked only against
  unknown hosts, not two real tenants (`GOV-08a`).
- No automated tests were added for the subdomain rules or the live-page filter; this repo's
  invariant tests are `FND-03`.
- 404 pages have a generic tab title (B-15).

---

## 2026-09-28 — Page archive (soft delete), two-tab Pages screen

Added an Archive step ahead of permanent delete for pages (`CNT-11`, D-029).

- `api/prisma/schema.prisma`: `Content.archivedAt DateTime?`, migration
  `20260928133117_add_content_archive`.
- `ContentRepository.findMany` now filters `archivedAt: null`; new `findManyArchived` and `archive`.
- `ContentService`: new `listArchived`/`archive`; `remove` (hard delete) now throws
  `ConflictException` (409) unless the page is already archived — enforced server-side, not just a
  hidden button.
- `ContentController`: `GET /content/archived` (registered before `:slug` so it isn't shadowed),
  `PATCH /content/:slug/archive`, both gated on the existing `content:delete` permission.
- `admin`: `contentApi.ts` gained `listArchivedPages`/`archivePage`; `PagesListPage.tsx` now has two
  tabs — **Pages** (Archive action + `window.confirm`, matching the existing delete-confirm pattern)
  and **Archived** (Delete Permanently action + confirm). Active list no longer offers delete at all.
- Verified end-to-end via CDP: created a test page, archived it (disappears from Pages, appears in
  Archived), hard-deleted it from Archived (gone), and confirmed a direct `DELETE` against a
  still-active page is refused with 409. `psql` confirmed no test rows left behind.
- Not built: restoring an archived page back to active — `BACKLOG.md` B-13.

---

## 2026-09-28 — Two Publish buttons, down to one

Asked whether the editor's Publish button works locally, and why there were two. Checked directly
rather than trusting the existing D-019 record: Puck's own native Publish button — recorded two days
ago as never rendering in this version — genuinely does render today, stacked right below `admin`'s
own custom one. Both were fully functional (identical `onPublish` call), so this wasn't a broken
button, just a confusing duplicate.

- `EditorPage.tsx`: `<Puck overrides={{ headerActions: () => <></> }} />` empties Puck's own
  header-actions slot; `admin`'s `.editor-publish` button is the one kept, `onPublish` stays wired on
  `<Puck>` regardless (so Puck's button would still work if the override were ever removed).
- Corrected the stale claim in both the code comment and `CLAUDE.md`'s gotchas that Puck's button
  "doesn't render" — full reasoning and what's still unresolved (why the original trace concluded
  otherwise) in `DECISIONS.md` D-028, which supersedes D-019's finding without editing it.

**Verified, not assumed:** confirmed exactly one "Publish" appears in the whole DOM before touching
anything (proving the duplicate was real, not a misread screenshot), applied the fix, then confirmed
again — one element, Puck's header-actions container empty, and clicked the one remaining button to
confirm it still actually publishes (status flips to "Published", `updated_at` moves in Postgres).

---

## 2026-09-28 — Media picker in block settings (`MED-03`)

Follow-up to the library page below, same day: closes the loop MED-02 left open — there was still no
way to *reuse* an uploaded file without hand-copying its URL.

- `ImageUploadField.tsx` gained a third action, "Browse", opening a new `components/
  MediaLibraryModal.tsx` — a grid over the site's media (filtered to images), click a thumbnail to
  fill the field and close the modal. No new API endpoint — reuses `listMedia()`/`GET /media`.
- Field layout changed from one row to two (URL input full-width, Upload + Browse below it as equal
  buttons) — three controls stopped fitting legibly on one row in Puck's narrow field panel.

**A real Puck gotcha found while verifying, not a product bug:** Puck mounts each field's `render`
twice — once visible in the sidebar, once as a zero-size ghost instance elsewhere in the DOM, both
wired to the same value. Harmless for a real user (only one is clickable), but tripped up an early
verification pass that used a plain `querySelectorAll` and happened to interact with the ghost first.
Filtering to a non-zero bounding rect fixed the test; documented in root `CLAUDE.md`'s gotchas so it
doesn't cost anyone else the same detour. Full writeup in `DECISIONS.md` D-027.

**Verified, not assumed:** CDP against the real editor — Browse against an empty library (correct
empty message), seeded a file via the existing Upload button, reopened Browse and confirmed the
thumbnail appeared, clicked it and confirmed the field filled with the exact matching URL and the
canvas re-rendered with the image, confirmed the modal closed. Screenshotted the modal itself with
real thumbnails, not just DOM assertions. `admin` typecheck/lint/build all pass. Test media rows,
files, and the accidental autosave into the real "Home" page were cleaned up afterward — caught one
leftover row from an earlier test on the first cleanup pass by checking `psql` rather than trusting
memory, and cleaned that up too before signing off.

**Not done:** no upload-from-within-the-modal shortcut (it's a picker over what already exists, not a
second upload surface); no "replace in place"; no warning before deleting a file still referenced on
a page — all still `BACKLOG.md` B-12.

---

## 2026-09-28 — Media library page (`MED-02`)

The actual `/media` screen the sidebar nav item has pointed at since it was first scaffolded —
previously 404'd. Given two real options for how it'd know what's been uploaded (list files straight
off disk, or back it with a real table), the user picked a real table; full reasoning and both
options' costs in `DECISIONS.md` D-026.

- **`api`**: new `Media` Prisma model (tenant-scoped, `uploadedByUserId`/`mimetype`/`size`/
  `createdAt`), `MediaRepository` (same `*_SELECT`-const pattern as `MembershipRepository` — never
  leaks more than the safe fields). `MediaService.store` now writes a `Media` row right after saving
  the file to disk; new `list`/`remove` methods (`remove` deletes the DB row, then the file on disk
  with `{ force: true }`). `MediaController` gained `GET /media` (`content:read`) and `DELETE
  /media/:id` (`content:delete`), alongside the existing `POST /media`.
- **`admin`**: new `/media` page (`MediaPage.tsx`) — a grid of the site's uploads, click a card for a
  detail panel (preview, filename/type/size/uploader, Copy URL, Delete). `mediaApi.ts` gained
  `listMedia`/`deleteMedia`; `uploadMedia` now returns the full `Media` row instead of just `{url}`
  (the `ImageUploadField` from `MED-01` needed no change — it only ever used `.url`).

**Verified, not assumed:** curl — empty list on a fresh site, upload returns full metadata with no
`passwordHash`-style leak, delete returns 204 and the file is actually gone from disk (checked with
`ls`, not just the API's word for it), a second delete 404s. CDP — uploaded a real file through the
grid's own Upload button, confirmed the card renders, opened the detail panel and confirmed every
metadata field matches the real API response, deleted through it (auto-accepting the native
`confirm()`), confirmed the grid returns to empty. `api`/`admin` typecheck, lint, build, and `api`'s
e2e suite all still pass. Test rows and files cleaned up afterward.

**Not done:** no warning before deleting a file that's still referenced on a page (`BACKLOG.md` B-12);
no thumbnailing; no "replace in place"; no reuse-into-a-field picker (`MED-03` — the natural next
step now that this grid exists).

---

## 2026-09-28 — Upload-from-computer for every image field in the block editor

First slice of `MED-01`, scoped to exactly what was asked: everywhere the editor lets you type a URL
for an image, add a side-by-side option to upload a file from disk instead.

- **`api`**: new `api/src/media/` — `POST /media` (`JwtAuthGuard` + `PermissionsGuard`,
  `content:write`), one file via `FileInterceptor`, validated against a fixed mimetype allowlist,
  written to `uploads/<siteId>/<uuid>.<ext>` (random filename — the actual tenant boundary, since
  `/uploads` itself is plain static serving with no per-request auth), served back via
  `app.useStaticAssets`. New `API_PUBLIC_URL`/`UPLOADS_DIR` env vars.
- **`admin`**: `lib/mediaApi.ts` + `apiUpload` (multipart, in `lib/api.ts`); new
  `components/ImageUploadField.tsx`, a Puck `type: 'custom'` field — text input (paste a URL,
  unchanged) plus an "Upload" button, side by side. Wired into all five image props that exist
  anywhere in `cms-blocks` (`Hero.image`, `ImageText.image`, `LogoCloud.logos[]`,
  `Gallery.images[]`, `TeamGrid.members[].photo`) via `puck/config.tsx`'s shared `imageSrcField`.

**Scope note:** no favicon field or video block exist anywhere in this codebase (checked before
writing code) — the request named them as examples of the pattern, not a checklist. Nothing was
built to fill a gap that isn't real yet; if either gets built later, this same field/endpoint covers
it. Full reasoning in `DECISIONS.md` D-025.

**Verified, not assumed:** curl — 401 unauthenticated, 400 on a disallowed mimetype, 201 on a real
PNG with the file confirmed byte-identical on disk and via a follow-up download. CDP — attached a
real file to the field's hidden input in a live running editor via `DOM.setFileInputFiles`, confirmed
the returned URL landed in the text field and the canvas re-rendered with the real image (not
broken), confirmed it autosaved. Screenshotted the field showing the text input and Upload button
side by side. The test upload and its autosave into the real "Home" page were cleaned up afterward
(file deleted, `content.blocks` reverted via `psql`) — the demo database is back to its normal state.
`api`/`admin` typecheck, lint, build, and `api`'s e2e suite all still pass.

**Not done:** no thumbnails, no media library (grid/reuse/replace/delete), no per-tenant storage
quota — tracked as `BACKLOG.md` B-12 / `EXECUTION_PLAN.md` `MED-02`/`MED-03`.

---

## 2026-09-25 — A site's Owner is permanent and singular

Follow-up restriction on the roles/invites feature below, requested after it shipped: an Owner's
role can never be changed via team management, and a site can never have a second Owner.

- **API**: `TeamService.updateMemberRole` now refuses (409) any attempt to change a membership whose
  role is already `owner`, and refuses (409) any attempt to set a role *to* `owner`.
  `TeamService.createInvite` refuses (409) an invite with `role: 'owner'`. `assignableRoleSchema`
  (`api/src/team/dto/membership.dto.ts`) narrows the Zod schema for both the update-member and
  create-invite request bodies to `administrator | editor | author | contributor`, so a bad request
  fails validation with a 400 before it even reaches the service — the service check is a deliberate
  second layer on top, not a substitute for it. Existing last-owner-removal protection needed no
  change; it now always fires correctly since owner count can never exceed 1. See `DECISIONS.md`
  D-024 for the full reasoning, including why "permanent" rather than "transferable" (no transfer
  flow requested or built — tracked as `BACKLOG.md` B-11).
- **Admin**: `admin/src/lib/roles.ts` adds `ASSIGNABLE_ROLE_OPTIONS` (excludes Owner); both role
  `<Select>`s on `/team` (invite form, per-member row) use it instead of the full role list. The
  Owner's own row now renders a static "Owner" label instead of an editable dropdown, and its Remove
  button is disabled with an explanatory title.

**Verified, not assumed:** the dev API was running stale code (not in `--watch` mode), caught when an
owner-role invite was accepted that should have been rejected — restarted it, then re-ran the same
request and confirmed 400. Full pass after restart, all via curl against the real API: invite as
`owner` → 400; PATCH the Owner's own membership → 409; PATCH a real second member's role to `owner` →
400; a legitimate role change on that same member → 200; DELETE the Owner's membership → 409
(unchanged). Test invite/member/user rows cleaned up from the database afterward. Admin UI confirmed
via CDP screenshot: Owner row shows the disabled label + disabled Remove button; invite dropdown
lists only the four assignable roles.

---

## 2026-09-25 — Custom dropdowns, and a real "Add Page" flow into the editor

Two fixes from a UI review, same day as the roles/invites work below.

- **Native `<select>` elements replaced with a custom dropdown** (`admin/src/components/Select.tsx` +
  `.css`, this repo's first shared UI component). The native ones rendered as plain white
  OS-chrome popups that didn't take the app's dark theme at all, with the browser's own default
  arrow glued to the box's right edge without the padding the rest of the UI uses everywhere else.
  Used in `TeamPage.tsx`'s two role selects (member row, invite form); confirmed via a real
  screenshot with the popup open, not just "it compiles."
- **"Open Page Builder" now actually opens the page builder.** It pointed at `/pages` (the list) —
  there was no way to create a new page from it, or from the Pages screen at all except the
  Dashboard's separate Quick Draft widget. Added `/pages/new` (`CreatePagePage.tsx`): a title field
  that creates the page via the same `createPage` call Quick Draft uses (renamed from
  `createDraftPage` — it's no longer only that widget's function) and redirects straight into
  `/editor/:slug`. Dashboard's button and a new "Add Page" button on `/pages` both point here now.

**Verified, not assumed:** CDP-driven — opened both dropdowns and screenshotted them mid-open (dark
popup, selected role highlighted, arrow with real spacing, not the OS default); clicked "Add Page" on
`/pages`, filled a title, submitted, confirmed it landed in the real Puck editor at the server-slugified
URL with the right title in the topbar. Test page deleted afterward.

**Not done:** `AdminLayout`'s site-switcher button is still decorative (unrelated to this — flagged
already in D-020/D-023, still open, no site-switching feature exists yet).

---

## 2026-09-25 — Real roles (`GOV-06`) and a team-invite flow

Full technical design in a plan file, approved before building (see `DECISIONS.md` D-023 for the
complete reasoning — this entry is the changelog, D-023 has the "why").

**`api`:**
- `Role` enum (`owner`/`administrator`/`editor`/`author`/`contributor`) replaces the free-text
  `SiteMembership.role`; new `Invite` model. Migration's auto-generated column-type change had to be
  hand-fixed (Prisma refused to cast existing data automatically).
- `PermissionsGuard` + `@RequirePermission(...)` (`api/src/auth/`), backed by a hardcoded
  `ROLE_PERMISSIONS` map — real enforcement, wired into `ContentController` (all 5 routes) and a new
  `TeamModule` (`sites/:siteId/team/*` for members/invites, public `invites/:token` +
  `invites/:token/accept` for the accept flow).
- Invite flow: one-time SHA-256-hashed tokens (no email infra exists — the link is copied/shared
  manually), 7-day expiry, auto-revoke on re-invite, last-owner protection on remove/demote, and an
  accept endpoint that creates a new account or attaches a membership to an existing one — always
  password-verified either way.

**`admin`:** new `/team` page (members table with inline role change/remove, pending invites with
revoke, an invite form that surfaces the one-time link with copy-to-clipboard) and public
`/accept-invite` page (new account or existing-account attach, ending in a real auto-login). Nav item
hidden for roles that can't manage the team — UI affordance only, confirmed by navigating there
directly as a non-owner and getting a real 403 from the API, not a silent client-side bypass.

**Two real bugs caught by testing, not code review** — full detail in D-023: a `passwordHash`/
`tokenHash` leak into API responses (fixed with explicit Prisma `select`s), and a completely
unenforced class-level `@RequirePermission` on `TeamController` (any authenticated user could manage
a team) caused by `Reflector.get` not reading class-level metadata — fixed with `getAllAndOverride`.

**Verified, not assumed:** full loop over curl + `psql`, then the same loop again through a real
Chrome tab over CDP driving the actual UI — described in full in D-023. All test data cleaned up
afterward; `api`/`admin` typecheck, lint, build, and `api`'s e2e suite all still pass.

**Not done:** no per-author content ownership (deliberate, see D-023); no real "active site" concept
(team/invite calls use the caller's first membership, same as the rest of `admin` already does); no
rate limiting on the accept-invite password check (logged, not silently ignored).

---

## 2026-09-25 — `corrickPages.ts` and its parity checker deleted

Follow-up to the two entries below, same day. Asked whether to delete `admin/src/data/corrickPages.ts`
now that all its content is real database rows — yes. That cascaded: `scripts/check-content-
parity.mjs` imported it directly to compare against `web/src/fixtures/corrick.ts`, so deleting the
file broke the script immediately (`ERR_MODULE_NOT_FOUND`, confirmed by running it). Flagged the
tradeoff rather than picking one silently — the script's whole premise (two duplicated files that
could drift) no longer applies now that `admin` doesn't hold a duplicate at all. Chose: delete the
script too, plus `scripts/migrate-corrick-pages.mjs` (its source file is gone, it can never run
again) and their `CLAUDE.md` entries. Full reasoning in `DECISIONS.md` D-022, including what's *not*
resolved: `web/src/fixtures/corrick.ts` is still a standalone fixture with no guardrail against
drifting from the real content, since `web` doesn't read the database yet (`CNT-07`).

---

## 2026-09-25 — Delete endpoint, plus all 4 demo pages migrated into the real database

Follow-up to the `CNT-01` work above, same day: added the delete capability that was flagged as
missing, and migrated the rest of the Corrick demo content into Postgres so the local database
matches the full original demo instead of just the one seeded page.

**`api`:**
- `ContentRepository.delete`/`ContentService.remove`/`ContentController.remove` — tenant-scoped hard
  delete, `DELETE /content/:slug`, `204` on success, `404` if the slug isn't on the caller's site.
  This is `CNT-11` partially — hard delete only, no trash/restore/undo.

**`admin`:**
- `lib/api.ts`: added `apiDelete`. `lib/contentApi.ts`: added `deletePage`.
- `PagesListPage`: each row gets a Delete action, `window.confirm`-gated, removing the row from local
  state on success rather than refetching the whole list.

**`scripts/migrate-corrick-pages.mjs` (new):** one-off migration, not part of the running app. Logs
into the real API, dynamically imports `admin/src/data/corrickPages.ts`, and POSTs each non-`home`
page's blocks through `/content` then `PATCH`es it published — reusing the *exact* Puck-data →
flat-block translation from `contentApi.ts` (duplicated into the script on purpose, same
type-only-imports trick as `check-content-parity.mjs`), not a hand-copy. This meant the migration
itself doubled as a real test of that translation across all 14 block types, including
`PricingTable`'s `features: {text}[]` → `features: string[]` special case.

**Verified, not assumed:**
- `psql` confirmed all 4 pages landed with correct block counts, and the Wholesale page's
  `pricingTable` block came through with `features` as a plain string array, not Puck's `{text}`
  wrapper objects
- Drove the delete through a real Chrome tab over CDP: logged in, clicked the real Delete button on
  "Harvest Log" in `/pages`, auto-accepted the native `confirm()` dialog via CDP's
  `Page.handleJavaScriptDialog`, and confirmed via `psql` the row was actually gone from Postgres —
  not just removed from the page's local React state
- Restored Harvest Log afterward (re-ran the migration script filtered to that one page) so deleting
  it for the test didn't leave the demo data incomplete
- Re-ran the finalized `scripts/migrate-corrick-pages.mjs` from a clean slate (deleted all non-`home`
  rows, restarted `api`, ran the script fresh) to confirm the committed version of the script — not
  just my working copy — actually works end to end
- `api` typecheck/lint/e2e and `admin` typecheck/lint all still pass

**Not done / not verified:**
- No trash or restore — a delete is permanent, no undo (`CNT-11`'s full scope)
- `admin/src/data/corrickPages.ts` is now fully unused (all 4 pages live in the database) but still
  not deleted — left in place per D-021, a call for you to make, not me
- The migration script isn't idempotent; re-running it against pages that already exist fails on the
  slug collision rather than upserting

---

## 2026-09-25 — Real content API: `FND-02` scoped repository, `CNT-01` CRUD endpoints, `admin` off `localStorage`

Closed the foundation gap flagged in the last review: everything in `admin` (pages list, editor,
Quick Draft) was reading/writing `localStorage`, not the database, while `api` had auth but no
content endpoints. Full decision reasoning in `DECISIONS.md` D-020; this is the changelog.

**`api`:**
- `ContentRepository` (`src/content/content.repository.ts`) — `findMany`, `findBySlug`, `create`,
  `update`, every method requiring `siteId` (invariant 1/2)
- `ContentService`/`ContentController` — `GET/POST /content`, `GET/PATCH /content/:slug`, behind
  `JwtAuthGuard`; `siteId` resolved from the caller's own `SiteMembership`, never from the request;
  server-side slugify with `-2`/`-3` collision suffixing (moved from `admin`, see D-020)
- Fixed a DI gap surfaced while wiring this up: `@UseGuards(JwtAuthGuard)` in a new module needs
  `JwtAuthGuard` as that module's *own* provider, not just exported by `AuthModule` — being exported
  isn't enough for a guard referenced by class, `JwtService` also has to be resolvable in the
  consuming module's own injector. Fixed by having `AuthModule` re-export its `JwtModule` instance too
  and adding `JwtAuthGuard` to `ContentModule`'s providers.
- `prisma/seed.ts` now also seeds one real "Home" page (hero + rich text, flat block contract) so
  `admin`'s Pages list isn't empty on a fresh clone

**`admin`:**
- Deleted `lib/pagesStore.ts` (the D-019 `localStorage` placeholder); added `lib/contentApi.ts`,
  which implements D-015's Puck-data ⇄ flat-block-contract translation for the first time (it was
  only ever planned before this) and talks to the real API
- `lib/api.ts`: added `apiSend` for authenticated POST/PATCH (content writes), alongside the existing
  `apiGet`/`apiPost`
- `PagesListPage`, `DashboardPage`, `EditorPage` all rewritten from synchronous `localStorage` reads
  to async API calls with real loading/error states (a real network call can fail; `localStorage`
  couldn't)

**Verified, not assumed** — full loop driven through a real headless Chrome tab over CDP, `psql`
alongside to check ground truth:
- Logged in for real; Dashboard's "At a Glance" showed `1 Pages / 1 Published / 0 Drafts` — the
  actual seeded row, not a fixture
- Submitted Quick Draft ("Winter Hours Update") — confirmed via `psql` a real row landed in
  `content`, not `localStorage`; Dashboard counts updated to `2 Pages / 1 Published / 1 Drafts`;
  Pages list showed both rows
- In the editor, clicked the real rendered Hero block inside Puck's canvas iframe, edited its
  headline field, waited past the autosave debounce — `psql` confirmed the new headline was in
  Postgres, flat contract, no leaked Puck-internal `id`
- Clicked the real Publish button — `psql` confirmed `status` flipped to `published`
- Opened a **second, fresh** tab at the same editor URL — it rendered the edited headline back,
  proving the read path (stored blocks &rarr; Puck data) round-trips, not just the write path
- Cleaned up test data afterward (deleted the Quick Draft row, re-ran the seed) so the repo's local
  database is back to the same one-page demo state a fresh clone would get

**Not done / not verified:**
- `siteId` resolution takes the user's first membership only — no multi-site disambiguation (needs a
  site switcher, `GOV-06`/`DEP-02`)
- `admin/src/data/corrickPages.ts`'s other three demo pages (wholesale, visit-the-farm, harvest-log)
  were not migrated into the database — only "Home" was seeded; that file is now dead code, left in
  place rather than deleted (see D-020)
- No delete endpoint (`CNT-11`, separate ticket); Puck's add/delete/reorder/duplicate canvas
  mechanics themselves still not interactively verified (`BLK-03`)
- `FND-03` (tenant invariant tests) still doesn't exist — nothing yet proves cross-tenant isolation
  by test, only by code review of `ContentRepository`'s signatures

---

## 2026-09-25 — Five gap fixes: editor autosave, JWT-expiry handling, Quick Draft, broken e2e test, content-drift check

Working through the gap list from the last review — five real fixes, not new features.

**1. Editor changes are saved now.** New `admin/src/lib/pagesStore.ts`: Puck's `onChange` autosaves
the current page data to `localStorage` (`cms-admin.draft.<slug>`, 500ms debounced); a page's draft
(if any) overlays its seed data from `corrickPages.ts` on load. Puck's own documented Publish button
turned out not to render at all in the installed version (real finding, traced into their source —
see D-019) — replaced with our own `<button>` in the topbar, backed by a ref tracking the latest
`onChange` data.

**2. Expired/invalid JWTs now force a re-login.** `RequireAuth.tsx` actively calls `GET /auth/me` on
every entry into a protected route instead of just trusting whatever's in `localStorage`; `lib/api.ts`'s
`apiGet` now clears the session and hard-redirects to `/login` on any 401 (scoped to `apiGet` only —
`apiPost` is also used for the *unauthenticated* login attempt itself, where a 401 means "wrong
password," not "dead session," and must not trigger the same redirect).

**3. Dashboard's Quick Draft actually creates a page.** Wired to `pagesStore.createDraftPage`: title
gets slugified, body becomes a single `RichText` block, the new page is appended to a second
`localStorage` key (`cms-admin.extra-pages`) alongside the 4 seeded ones. Shows up in the Pages list,
in "At a Glance" counts, and opens correctly in the editor.

**4. `api/test/app.e2e-spec.ts` fixed for real.** The `import { App } from 'supertest/types'` never
resolved — verified neither `supertest@7.3.0` nor `@types/supertest@7.2.1` expose that subpath or
re-export `App` from anywhere public. Dropped the import; `INestApplication`'s `TServer` generic
already defaults to `any`. `npm run test:e2e` passes now (previously never ran clean).

**5. `web`/`admin` corrick-content drift now has a guardrail.** New `scripts/check-content-parity.mjs`
at the repo root — compares page paths and per-page block-type sequences between `web/src/fixtures/
corrick.ts` and `admin/src/data/corrickPages.ts` without ever cross-importing between the two repos
(each file has only type-only imports, so a plain `node --experimental-strip-types` dynamic `import()`
loads it standalone; the check never uses either project's own bundler/tsconfig). Checks structure
(same pages, same block sequence), never prose — the written copy is deliberately independent. Run
now: **4/4 pages match.** Not wired into CI (no CI exists yet — `XRP-02`).

**Verified — real interaction throughout, driven over the DevTools Protocol on a running Chrome tab:**
- Autosave: clicked the actual rendered Hero block inside Puck's real same-origin canvas iframe,
  edited its `headline` field for real, confirmed the debounced write landed in `localStorage`, clicked
  the real Publish button, then opened a **fresh tab** at the same URL and confirmed the edited
  headline is what rendered — the full round trip, not just "a function ran."
- JWT expiry: corrupted the stored `accessToken` in `localStorage`, reloaded, confirmed `RequireAuth`'s
  `/auth/me` check caught it and redirected to `/login` with the session cleared.
- Quick Draft: filled the real form, submitted, confirmed "At a Glance" went from 4→5 pages and 0→1
  drafts, confirmed the new page appears in the Pages list as Draft, confirmed it opens correctly in
  the editor.
- `npm run test:e2e` — actually run, passes.
- `check-content-parity.mjs` — actually run, passes.
- `api` and `admin` both typecheck, lint (one expected, documented oxlint warning on the deliberate
  `useMemo` dependency choice in `EditorPage.tsx`), and build clean.

**Not done / not verified**
- None of this is real persistence — `localStorage`, one browser, one machine. `CNT-01`/`CNT-02`
  still replace all of it.
- The Publish button's root cause in Puck's own code wasn't fully resolved, only worked around —
  logged in `CLAUDE.md` gotchas and D-019 for whoever hits it next.
- `check-content-parity.mjs` is a manual script, not wired into any CI (none exists) or pre-commit hook.

## 2026-09-25 — Pages list: View link alongside Edit on every row

**What changed:** `PagesListPage.tsx` had only "Edit" per row. Added "View ↗" next to it, using the
same `siteUrl(page.path)` helper the Dashboard's "Visit Site" link already used — so every row now
opens either the `admin` editor for that page or the real `web` page for it, in a new tab.

**Verified** — logged in for real over CDP (as in the previous two entries) and read every row's
actual `<a>` tags: all 4 have `Edit → /editor/<slug>` and `View → http://127.0.0.1:3000/preview/
corrick<path>, target="_blank"`, and `curl`-confirmed all 4 `View` URLs return 200. Screenshotted the
list to confirm the layout reads cleanly with both links present. Typechecks, lints, and builds clean.

## 2026-09-25 — Dashboard "Visit Site" link, basic Settings screen, all 4 Corrick pages published

**What changed**
- New `admin/src/data/site.ts` — `currentSite` (name/tagline/host, duplicated from `web`'s corrick
  fixture, same D-017 reasoning) and `siteUrl(path)`, which points at `web`'s preview stand-in
  (`VITE_WEB_URL`, defaulting to `http://127.0.0.1:3000` — not `localhost`, to sidestep the stale-
  redirect gotcha already documented in `CLAUDE.md`).
- Dashboard gained a **Visit Site** link next to "Open Page Builder", opening `siteUrl()` in a new tab.
- New `/settings` route (`SettingsPage.tsx`), filling the sidebar nav item that's existed since the
  dashboard build but 404'd until now (same situation `/pages` was in before that got built). Two
  cards: Site Identity (name/tagline editable in local state only, no save endpoint — a "Saved..."
  note appears on submit but nothing persists) and Your Account (read-only, pulled straight from the
  real logged-in session — name, email, role). Logged as `BACKLOG.md` B-10, since no
  `EXECUTION_PLAN.md` ticket covers a site-settings screen.
- `corrickPages.ts`: `wholesale` and `harvest-log` flipped from `status: 'draft'` to `'published'` —
  all 4 pages are published now. Dashboard's Activity feed's "Edited" labels for those two updated to
  "Published" to match (they're independent flavor data, would otherwise have contradicted the Pages
  list's own status badges).

**Verified — real interaction again, not just render checks:** reused the headless-Chrome-over-CDP
approach from the previous entry (fresh profile, to avoid the stale-session false-alarm from last
time) to log in for real, then: confirmed the Dashboard's Visit Site link has the correct
`href="http://127.0.0.1:3000/preview/corrick"` and `target="_blank"`; confirmed "At a Glance" now
reads 4 Published / 0 Drafts; confirmed the Pages list shows all 4 rows as Published; loaded
`/settings` and confirmed the Site Identity fields are pre-filled and the Account card shows the real
seeded user (Umair Khalid, the real email, "Owner"); clicked the real Save Changes button and
confirmed the confirmation note appears (first check raced the click against React's render commit
and falsely read "not found" — recognized as a test-timing bug, not a product bug, and confirmed by
re-running with a short delay between the click and the check).

**Not done / not verified**
- Settings doesn't persist anywhere — refreshing the page reverts any edited field. No API endpoint
  exists for it.
- "Visit Site" always points at Corrick's home page (`/preview/corrick`), not the specific page being
  edited — matches what was asked ("on the dashboard"), not extended to per-page "View" links on the
  Pages list, which would be a natural but unrequested follow-up.
- Account details (name/email) are display-only by design — no edit-account flow was asked for or built.

## 2026-09-25 — Real auth: login endpoint, JWT guard, seeded account, wired end to end

**What changed**
- `api`: new `AuthModule` (`src/auth/`) — `POST /auth/login` (Zod-validated body, `bcryptjs` compare
  against `User.passwordHash`, signs a JWT via `@nestjs/jwt`), `GET /auth/me` (guarded), and
  `JwtAuthGuard` (hand-rolled `CanActivate`, no passport). New `src/users/user.repository.ts` +
  `UsersModule` — `PrismaService` access still only from a `*.repository.ts` file, per invariant 2,
  even though `User` isn't tenant-scoped content. New `src/common/zod-validation.pipe.ts`, a small
  generic pipe (validation is Zod project-wide, not class-validator — invariant 4).
- `api/prisma/seed.ts` (`npm run db:seed`) creates the first real rows in every `FND-01` table: one
  `Site` (Corrick Oyster Co., `themeJson` matching what's already duplicated into `web` and `admin`),
  one `User`, one `SiteMembership` (role `owner`). Ran it — verified with `psql` that the rows are
  really there, not just that the script exited 0.
- `admin`: `src/lib/api.ts` (fetch wrapper, `ApiError`), `src/lib/auth.ts` (session get/set/clear via
  `localStorage`), `src/lib/RequireAuth.tsx` (route guard, redirects to `/login` with no session).
  `LoginPage.tsx` now actually calls `/auth/login`, shows a real error on 401/400, stores the session,
  and redirects to `/dashboard`. `AdminLayout`'s topbar shows the real logged-in user's name/initials
  and the real site name from `session.memberships[0]`, plus a working **Log Out** button (was a
  decorative "TO Test Owner" stub before).

**Verified — with real interaction, not just curl/typecheck:**
- `api`: `curl`-tested wrong password (401), malformed body (400, Zod messages), correct login (200,
  real JWT + user + membership), `/auth/me` with and without the token (200 / 401), and a CORS
  preflight from `admin`'s origin (204, correct `Access-Control-Allow-*` headers).
- `admin`: no click-automation tool is available in this environment, so rather than skip interactive
  testing (as every previous entry has had to), drove a real headless Chrome tab over the DevTools
  Protocol directly — Node 26's built-in `fetch`/`WebSocket` were enough, no new dependency. Filled the
  actual `#login-identifier`/`#login-password` inputs (dispatching real `input` events so React's
  controlled-input state updates), called `form.requestSubmit()`, and confirmed: redirect to
  `/dashboard`, a real session written to `localStorage`, and the dashboard rendering the real seeded
  user ("Umair Khalid", "UK"), the real site ("Corrick Oyster Co."), and correct published/draft
  counts (2/2, matching the 4 real `corrickPages.ts` entries). Separately confirmed **Log Out** clears
  the session and redirects to `/login`, and that `RequireAuth` redirects an unauthenticated visit to
  `/dashboard` back to `/login` (first attempt looked like it failed — actually a stale session left
  in the CDP test's own Chrome profile from the prior test, not a bug; confirmed by clearing
  `localStorage` and reloading before re-checking).
- `api` and `admin` both typecheck, lint, and build clean.

**Not done / not verified**
- No role enforcement — `SiteMembership.role` is stored and returned but nothing checks it yet.
  `RequireAuth` only proves a session exists, same "UI affordance, not enforcement" caveat that
  already applied to `admin` before this (`api/CLAUDE.md` invariant 3).
- `Content`/`Site` repositories (the actual `FND-02` ticket, tenant-scoped) still don't exist —
  `PagesListPage`/`EditorPage` still read `corrickPages.ts`, not the API. Login is real; content isn't, yet.
- No registration, lost-password, or reset-password backend — those screens are still UI-only.
- JWT lives in `localStorage`, not an httpOnly cookie — a deliberate, documented tradeoff (D-018),
  not an oversight.

## 2026-09-25 — Multi-page support, built and tested with Corrick as the real subject

**What changed**
- `web`: `SiteFixture.page` → `SiteFixture.pages: SitePage[]`. `SiteChrome` now takes an explicit
  `page` prop instead of deriving it, since a site has many now. The dev preview route moved from
  `/preview/[site]/page.tsx` to `/preview/[site]/[[...path]]/page.tsx`, resolving a page by matching
  URL segments against `SitePage.path` (`/` for home), with `generateStaticParams` covering every
  page of every fixture site.
- `corrick.ts` grew from 1 page to 4: the existing Home, plus **Visit the Farm** (Gallery, TeamGrid,
  Faq), **Wholesale** (LogoCloud, PricingTable, ContactForm — restaurant partners include "The Lower
  Landing," Nina Alvarez's restaurant from the existing testimonial), and **Harvest Log** (Stats,
  RichText, Testimonial, Spacer, Faq). Nav and footer links that now point at real pages
  (`/visit-the-farm`, `/wholesale`, `/harvest-log`) were updated from anchors to real paths; `kestrel.ts`
  wrapped its single page in the new array shape unchanged.
- `admin`: extracted the Puck `config` and `EditorComponents` type out of `EditorPage.tsx` into
  `admin/src/puck/config.tsx` so more than one screen can use it. New `admin/src/data/corrickPages.ts`
  holds the same 4 pages as independent Puck `Data` objects (see D-017 for why this isn't imported
  from `web`). New `/pages` route (`PagesListPage.tsx`) lists them with path and status, matching the
  AdminLayout sidebar nav item that already existed but 404'd. `/editor` became `/editor/:slug`,
  reading the matching page from `corrickPages.ts`; unknown slugs redirect to `/pages`. Swapped the
  previous session's invented `demoTheme` (coral/teal, for the block-library test) for Corrick's real
  theme values, duplicated from `web/src/fixtures/corrick.ts` — the editor canvas now actually looks
  like the real Corrick site, not an unrelated brand. Dashboard's "Open Page Builder" now goes to
  `/pages` instead of straight to a single hardcoded page; Activity items link to their real pages.
- Added 17 placeholder SVGs to both `web/public/media/` and `admin/public/media/` for the new pages'
  images (farm photos, crew headshots, restaurant logos) — duplicated per repo for the same reason as
  the page content itself.

**A real bug found and fixed while testing, not just described:** the preview route's cross-page
links needed a `/preview/corrick` prefix (production-shaped fixture hrefs like `/wholesale` aren't
directly routable under the temporary preview prefix). The first pass only rewrote `settings.nav` and
`settings.footer` — missed that blocks carry the same kind of link (`Hero.secondaryAction`,
`Cta.action`, ImageText's `action`, ...) in props scattered across all 14 block types. Found by
grepping the actual rendered page's `href` attributes rather than assuming the nav fix was enough —
`curl ... | grep href` turned up `/harvest-log` un-prefixed next to the correctly-prefixed nav links,
and confirmed the un-prefixed form 404'd. Fixed with one generic recursive `prefixHrefs` walker over
the whole fixture (any `href` key starting with `/`, anywhere in the object tree) instead of updating
every block type's link fields by hand.

**Verified** — `web` and `admin` both typecheck, lint, and production-build clean (`web`'s build log
shows 5 static pages generated: 4 Corrick + 1 Kestrel). Ran both dev servers and: screenshotted
`admin`'s `/pages` list (4 rows, correct published/draft status) and `/editor/visit-the-farm` (loads
that page's real content, canvas themed in Corrick's actual green/tan palette, not the previous
session's invented one); screenshotted `web`'s `/preview/corrick`, `/preview/corrick/wholesale`, and
`/preview/corrick/harvest-log` (all render correctly, themed, with the new blocks — LogoCloud,
PricingTable, ContactForm, Stats, Spacer, Faq, Gallery, TeamGrid — all appearing on real content for
the first time rather than the synthetic test page); `curl`-verified every in-page link across two
pages resolves to a prefixed URL that itself returns 200, not just that it looks right.

**Not done / not verified**
- `admin`'s `corrickPages.ts` and `web`'s `corrick.ts` are independently authored, not generated from
  one source — a future edit to one won't propagate to the other. Explicitly accepted in D-017 as a
  temporary cost, not an oversight.
- Still no interactive testing of Puck's add/delete/reorder/duplicate, or of the Pages list's own
  affordances beyond following its links — same headless-screenshot ceiling as every previous entry.
- No page-creation flow — `corrickPages`/`corrick.pages` are fixed arrays; there's no "new page"
  button anywhere. Out of scope for what was asked (test multi-page on existing content).
- Host-based tenant resolution (the actual point of `CNT-07`) still doesn't exist; `/preview/[site]`
  slug-in-the-URL remains the stand-in.

## 2026-09-25 — Editor tested end to end with a full 14-block page; found and fixed a real theming gap

**What prompted this:** asked to test the editor in detail by building a real, full, colourful landing
page, not another single-block screenshot. Doing that surfaced a genuine bug that the earlier,
lighter testing had missed.

**Bug found:** `EditorPage.tsx` never wrapped Puck's canvas content in `SiteThemeRoot`. Every block
reads `--site-*` custom properties for its colours, radii, spacing and type — with no `SiteThemeRoot`
providing them, every one of those was undefined the whole time. The "fully styled" claim in the
previous entry was true of layout and structure (grid, borders, spacing all come from Tailwind
utility classes, which don't need `--site-*`) but not of colour or type — the canvas was rendering
with browser-default black text, no accent colours, and the system font, and this was not caught
because the earlier screenshot's fixture data (dark Hero background) happened to look plausible by
coincidence, not because it was actually themed.

**Fix:**
- `admin/src/pages/EditorPage.tsx`: added `config.root.render` wrapping Puck's `children` in
  `<SiteThemeRoot theme={demoTheme}>`, the same component `web/src/site/SiteChrome.tsx` uses. `Puck`
  calls `root.render` inside its own canvas iframe, so this scopes the theme to the canvas only, not
  the surrounding editor chrome.
- `demoTheme` is a new, deliberately bold/colourful palette (`#D94F30` coral brand, `#1B8A6B` teal
  accent, warm cream paper) — picked distinct from the muted `corrick` fixture in `web` specifically
  so a correctly-themed canvas couldn't be mistaken for a coincidence.
- Found a second, related gap while fixing the first: `theme.ts`'s `TYPE_SETS` reference
  `--font-fraunces`, `--font-karla`, etc. — CSS variables `web` gets for free from `next/font`, which
  `admin` (Vite, no Next.js) never defined. Fixed by loading the five families as plain Google Fonts
  in `admin/index.html` and mapping them to the same variable names in `admin/src/index.css`. Without
  this, `SiteThemeRoot` would have resolved but every block would still render in the system font.
- Both gotchas — no theme wrapper, no font vars — are now documented in `CLAUDE.md`.

**The test itself:** replaced the 3-block `initialData` with a full one-pager for a new fictional
demo brand, "Marlow & Finch Coffee Roasters" (deliberately not `corrick`, so it can't later be
confused for real tenant data), using all 14 blocks in a realistic order: Hero, LogoCloud, FeatureGrid,
Stats, ImageText, Gallery, TeamGrid, Testimonial, PricingTable (middle plan highlighted), Spacer, Faq,
RichText, ContactForm, Cta. Added 17 placeholder SVGs under `admin/public/media/` (hero, roastery,
6 gallery shots, 4 team photos, 5 partner logos) so every image-bearing block renders a real image
instead of a broken-image icon.

**Verified** — `admin` typechecks, lints, and production-builds clean. Screenshotted the full page
(1600×10000 window, 12s virtual time budget) and reviewed it in sections: every block renders with
the demo theme's real colours (coral CTAs, teal accents and checkmarks, cream backgrounds, grain
texture), Fraunces on headings vs. Karla on body text confirms both type-set fonts loaded, and the
`PricingTable` highlighted-plan border/button and `TeamGrid`/`Gallery` image grids all render
correctly. One cosmetic artifact noted and ruled out as a real bug: a solid black area appears below
the page content in the screenshot — this is Puck's own canvas fill colour showing through because
the screenshot's window height (10000px, chosen to capture the whole page at once) is far taller than
the actual page content; at a normal viewport height this is never visible.

**Not done / not verified**
- Still no interactive testing of add/delete/reorder/duplicate, drag-and-drop, or typing into Puck's
  field panel — headless screenshot can only prove render correctness on data supplied programmatically,
  the same limitation noted in every previous entry.
- `demoTheme` is hardcoded in `EditorPage.tsx`; there's no site-settings screen yet to let a real
  tenant pick or edit their theme. Themes remain code-defined fixtures until that ticket exists.
- The dev server's `localhost:5173` vs `127.0.0.1:5173` gotcha resurfaced (IPv6-only bind meant
  `curl 127.0.0.1` got connection-refused while `curl localhost` worked) — not new, not re-documented
  as a gotcha since it's a general Vite/curl quirk, not project-specific.

## 2026-09-25 — Eight more blocks: LogoCloud, Stats, FAQ, Spacer, Gallery, PricingTable, TeamGrid, ContactForm

**What changed**
- Added 8 block types to `cms-blocks` (`types.ts`, one component file each, `registry.ts`,
  `index.ts`), covering most of `BLK-02` ("remaining render blocks: gallery, embed, FAQ") plus
  extras beyond that ticket's original scope (logo cloud, stats, spacer, pricing table, team grid)
  and the block half of `BLK-06` (contact form — no submission endpoint, see below).
- `LogoCloud`, `Stats`, `Gallery`, `TeamGrid` follow the existing array-of-objects pattern (same
  shape as `Hero.facts` / `FeatureGrid.items`). `Faq` uses native `<details>/<summary>` — an
  accordion with zero client JS. `Spacer` is a layout utility, not real content (no `--site-*`
  colour use at all, so invariant #2 doesn't apply to it).
- `ContactForm` is the one block needing interactivity (submit handler, `useState`) and so is the
  first block in `cms-blocks` marked `'use client'` — necessary because `web/src/site/SiteChrome.tsx`
  (the tree `BlockRenderer` renders inside) is a server component. Submit just shows a "not wired up
  yet" message; no `api` endpoint exists to receive it (that's the still-open half of `BLK-06`).
- `PricingTable` is the one block whose Puck editor fields don't map 1:1 onto its `cms-blocks` type:
  `PricingPlan.features` is `string[]` in the content contract, but Puck's `array` field type has no
  "array of plain strings" mode — every array is edited as an array of objects. Editor-side, each
  feature is edited as `{ text: string }` and flattened to a plain string in `render()`, the same
  translate-at-the-Puck-boundary pattern as `D-015`. Documented inline in `EditorPage.tsx`, not
  written up as a separate `DECISIONS.md` entry since it's an instance of that decision, not a new one.
- Wired all 8 into `admin/src/pages/EditorPage.tsx`'s Puck `config.components`, and added `Stats` +
  `Faq` (in addition to the existing `Hero`) to `initialData` so the canvas opens already showing
  three of the new blocks rendered, not just listed in the block picker.

**Verified** — `cms-blocks` builds clean (`tsc -p tsconfig.build.json`); grepped for hex colours
(`grep -rnE '#[0-9a-fA-F]{3,8}\b' src` — the one hit, `&#10003;` in `PricingTable.tsx`, is the
checkmark HTML entity, not a colour); `admin` and `web` both typecheck and lint clean. Screenshotted
`/editor` after restarting `admin`'s dev server (a stale process from an earlier session was holding
port 5173 without actually accepting connections — killed and restarted): all 14 blocks appear in
the block picker, and `Hero` + the pre-populated `Stats` + `Faq` render fully styled in the canvas.

**Not done / not verified**
- Add/edit/delete/reorder were not interactively tested for the new blocks, same caveat as the
  original 6 (headless screenshot can't simulate Puck's drag-and-drop or field-panel typing).
- `ContactForm` has no submission endpoint — pure UI, matches how `LoginPage`/`LostPasswordPage`
  were built non-functioning first.
- `VideoEmbed` was suggested but intentionally not built — it needs a decision on whether to allow
  raw iframe embeds (tension with invariant #5, sanitise-on-write) or restrict to a parsed
  YouTube/Vimeo URL field. Left for `BLK-02`'s "embed" line item.

## 2026-09-25 — `cms-blocks` extracted; Tailwind in `admin`; real block editor built

**What changed**
- Extracted the shared block package for real (`XRP-01`, `DECISIONS.md` D-016): moved the 6 block
  components, `types.ts`, `registry.ts`, `BlockRenderer.tsx`, `ui.tsx`, and the theme system out of
  `web` into `cms-blocks/` at the `CMS/` root, consumed by `web` and `admin` via `file:` dependencies.
  `cms-blocks` builds to `dist/` (`npm run build`); `web`'s `next.config.ts` now transpiles it and
  widens `turbopack.root` to the container so the sibling package resolves at all.
- Executed `D-010` (decided 2026-08-31, not done until now): `admin` adopts Tailwind 4
  (`@tailwindcss/vite`), needed because the shared blocks are styled with Tailwind utilities.
- Deleted `web/src/app/dev/puck-spike/` — superseded by the real thing below.
- Built the actual editor in `admin`: `src/pages/EditorPage.tsx`, full-screen (not wrapped in
  `AdminLayout`'s sidebar — a Webflow-style focused canvas mode, distinct from the dashboard shell).
  All 6 blocks wired into Puck's `config.components` with real field definitions (text/textarea/
  object/array/radio, matching each block's actual prop shape), a custom slim top bar above Puck's
  own native toolbar (which already has Webflow-style viewport icons and a Publish button). Route:
  `/editor`. Linked from the dashboard via a new "Open Page Builder" button and clickable Activity
  items. Pre-populated with a sample Hero so it doesn't open empty — no content API exists yet.

**Two real bugs found and fixed, not just described:**
1. Turbopack's production build wouldn't resolve `cms-blocks` at all (`web`) — its real path is
   outside `turbopack.root`, which was pinned to `web/` itself. Fixed by widening it to the `CMS/`
   container. `next dev` had masked this; only `next build` caught it.
2. The shared blocks rendered completely unstyled inside Puck's canvas in `admin` — not a Puck/
   iframe issue as first suspected, but a copy-paste error: `admin`'s `@source` path for
   `cms-blocks/src` was copied verbatim from `web`'s gotcha without adjusting for `admin/src/
   index.css` being one folder shallower. Confirmed via the compiled CSS output (6 generic classes
   instead of hundreds) before fixing, not guessed.

**Verified** — `cms-blocks` typechecks standalone; `web` and `admin` both typecheck, lint, and build
clean; `web`'s two prerendered preview routes still build; `admin`'s editor screenshotted with all 6
blocks in the picker and the Hero block rendering fully styled (grid layout, borders, type scale) —
compared against the broken screenshot taken before the `@source` fix to confirm the difference was
real, not incidental.

**Not done** — no persistence: the editor isn't reading from or writing to the API (`CNT-01`/`CNT-02`
don't exist yet), so `BLK-03`/`BLK-04` are meaningfully advanced but not marked done — see
`EXECUTION_PLAN.md`. `RichText`'s `html` field is a plain textarea, not TipTap (`BLK-05`). No delete/
duplicate/reorder was interactively tested (headless screenshot can't drag or click) — only render-
with-real-data and the block picker listing were directly observed.

---

## 2026-09-25 — Puck spike; MVP database schema and initial migration (`FND-01`)

**What changed**
- Built a throwaway spike at `web/src/app/dev/puck-spike/page.tsx`, wiring the real `Hero` component
  (imported directly, not copied — invariant 3 intact) through `@puckeditor/core`'s `config.components`.
  Confirmed Puck genuinely renders inside a same-origin iframe, and read its real `ComponentData`/`Data`
  types from the installed package source rather than guessing. Result: `DECISIONS.md` D-015 — the
  flat `content.blocks` contract is kept, Puck's native shape is translated at the `admin` boundary,
  never stored.
- Implemented the MVP schema in `api/prisma/schema.prisma`: `Site`, `User`, `SiteMembership`,
  `Content` — the minimum to log a user in, resolve their site, and save a page's block array.
  Deliberately excludes named roles (`GOV-06`), publish-state transitions (`CNT-03`), page hierarchy
  and path recomputation (`CNT-05`/`CNT-06`), custom content types (`TYP-*`), media, SEO, taxonomy,
  menus, revisions — all still real, still planned, just not required to prove the editor works.
- Created `api/.env` (was missing) and the `cms` Postgres database (was also missing — `DECISIONS.md`
  D-002 documented it as already created; it wasn't, on this machine at least). Ran the initial
  migration (`20260925085520_init_mvp_schema`).

**Verified** — `prisma migrate dev` applied cleanly against the real local Postgres; `psql \dt` confirms
all four tables exist; full project typecheck passes except one pre-existing, unrelated error
(`test/app.e2e-spec.ts`'s `supertest/types` resolution, not touched in this entry); a throwaway
`vitest` smoke test created and linked one real row per model through the generated client, confirmed
`content.blocks` stores the flat shape correctly, then cleaned up after itself.

**Not done** — `FND-02` (scoped repository layer), `FND-03` (tenant invariant tests), and everything
listed as deliberately excluded above. The Puck spike route is throwaway and should be deleted once
`XRP-01`/`BLK-03` supersede it.

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
