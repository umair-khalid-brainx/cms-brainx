# Week 3 plan (M3, "This is the pitch")

Drafted 2026-10-09 from a ticket review with the user. Choices below are the user's answers; each is
tied to the client's "CMS and Page Management Requirements" (req. N = section N of that doc).
When a step lands, the usual doc rules apply (WORKLOG, STATUS, ticket file, DECISIONS).

**Rule for this week:** build only what the requirements or tickets ask for, and make it correct.
No extras (the user turned down a "Campaign" template on these grounds).

## Where week 3 stands

| Ticket | Status on `main` | Real state |
|---|---|---|
| BLK-04 | IN-PROGRESS | Done on `claude/blk-04-clarification-b98f1d`: labels plus browser check |
| BLK-05 | TODO | Not started |
| BLK-06 | IN-PROGRESS | Done on `claude/blk-06-clarification-c37928` |
| BLK-07 | TODO | Not started |
| TYP-01 to TYP-04 | TODO | Not started. TYP-04 needs TYP-05, which is done on the week-2 branch |
| MED-01 | IN-PROGRESS | Done on `claude/med-01-clarification-c61f8b`: sharp thumbnails |
| MED-02 | IN-PROGRESS | Done on `claude/med-02-clarification-592e8f`: replace plus usage warning |
| MED-03 | DONE | |
| MED-04 (new) | — | Documents plus alt/title/description (req. 4) |

## Decisions made in the review

| # | Question | Answer | Requirement served |
|---|---|---|---|
| 1 | Merge unmerged branches first? | Yes, all seven (five week-3 + BLK-02 + BLK-03) | — |
| 2 | Six field kinds | **Text, rich text, date, media, select, link** | Req. 2 CTAs, req. 4 documents, "custom page types" |
| 3 | How the blog relates to types | **Built-in, seeded "Post" type** per site at `/blog`, same machinery as custom types | Req. 3 |
| 4 | Entry editor | **Fields panel + normal block body** for every type | Req. 2 "reusable blocks", req. 3 body |
| 5 | Field values on the public page | **Auto entry header**: title, then fields in type order; block body below | "Minimal developer involvement" |
| 6 | `/<prefix>` index | **Simple newest-first listing now**; TAX-02 extends it in week 4 | Req. 3 "archive pages" |
| 7 | Rich-text toolbar | **H2, H3, paragraph, bold, italic, bulleted and numbered lists, link, quote** | Req. 2 exactly |
| 8 | Rich text and inline editing | **Puck 0.23's built-in `richtext` field + `contentEditable`**, not a hand-rolled `Editable` | Req. 2 "easy-to-use editor" |
| 9 | Media gaps | **New ticket MED-04**: PDF/DOCX/XLSX uploads plus alt text, title, description | Req. 4 |
| 10 | Templates on create | **The four existing layouts + Blank**; no new layouts | Req. 6, no extras |

Defaults I chose without asking (shout if any is wrong):
- Managing types needs `site:manage` (owner, administrator), like WordPress's Administrator.
- A type's URL prefix is locked once it has entries. Renaming is unsupported (ARCHITECTURE.md).
- A prefix can't clash with a top-level page slug, a reserved word or another type's prefix, and
  page creation checks the same in reverse.
- Deleting a type that still has entries is refused (409).
- Inline editing covers visible text props (headings, body copy, button labels), not URLs or alt.
- HTML sanitiser: `sanitize-html` in `api`, with an allowlist that matches the toolbar exactly.

## Step 0 — Merge (~0.3 d)

Order (each merge: resolve conflicts, then `api` test + typecheck + lint, `admin` and `web` build):

1. `claude/week-2-tickets-review-936c71` (GOV-08a, CNT-08/09/10/12, TYP-05). Keeps D-036–D-039 and B-16–B-18.
2. `claude/blk-02-context-e0e75c` (video embed, dark-mode fix)
3. `claude/blk-03-persistence-tests-973983`
4. `claude/blk-04-clarification-b98f1d`
5. `claude/med-01-clarification-c61f8b`
6. `claude/med-02-clarification-592e8f`
7. `claude/blk-06-clarification-c37928`. Expect a conflict in `public.service.ts`: `findSite` is
   now `findSiteId` (FND-04).

Renumber clashing IDs while merging (body references too):

| Branch | Was | Becomes |
|---|---|---|
| blk-02 | D-033 (clashes with main's tickets split) | D-040 |
| blk-03 | D-034 | D-041 |
| blk-06 | D-034 | D-042 |
| med-01 | D-036 | D-043 |
| med-02 | D-037 | D-044 |
| blk-02 / blk-04 / blk-06 | B-16, B-17 | B-19 onward, merging duplicates (several look like the same "canvas dark mode" item) |

Then: commit `docs/REQUIREMENTS.md` (the client's text), refresh `STATUS.md` totals, and run the
whole stack once in the browser (editor, media, public site on two hosts).

**Gate:** all builds and tests green on `main`; STATUS shows BLK-04, BLK-06, MED-01, MED-02 DONE.

## Step 1 — BLK-05 TipTap + sanitise on write (~0.4 d)

1. **Spike (first hour):** a Puck `richtext` field on the RichText block in the canvas. Confirm
   that it stores an HTML string, which extensions it allows, and how `contentEditable` hands the
   prop to `render` (a ReactNode, not a string). Record the result as a D-entry.
2. `admin`: RichText `html` and FAQ answers use `type: 'richtext'` with the req. 2 toolbar.
3. `api`: one `sanitizeHtml()` helper with the toolbar's allowlist (`p h2 h3 strong em ul ol li a
   blockquote br`; `a[href]` limited to http/https/mailto, with `rel` forced on). It runs in the
   content write path over every rich-text prop and, later, rich-text field values. Starter layouts
   copied by TYP-04 go through the same path.
4. `web`: no change. Renders stored HTML as-is (invariant 5).
5. Tests: strips `<script>`, `on*=`, `javascript:` hrefs and `style`; keeps everything the toolbar
   produces; the public page doesn't sanitise again.

## Step 2 — BLK-07 inline editing (~0.3 d)

1. `contentEditable: true` on visible text fields in `admin/src/puck/config.tsx`.
2. `cms-blocks`: text props take `string | ReactNode` **at render time only**. Stored types
   (`types.ts`, invariant 7) stay strings. The public site always passes strings, so nothing changes
   there.
3. Rich text in the canvas uses the same Puck richtext and toolbar as Step 1.
4. Check in a real browser: click a heading on the canvas, type, see the sidebar update, save,
   reload, see it persist and render on the public site.

## Step 3 — MED-04 documents and metadata (~0.3 d) — new ticket

1. `Media` gains `alt`, `title` and `description` (nullable). Add a `PATCH /media/:id`.
2. Allow `application/pdf`, DOCX and XLSX (whitelisted mimetype → extension, as today). No
   thumbnail; the library shows a file-type tile.
3. `/media` detail panel: editable alt, title, description, plus type, size and upload date (req. 4).
4. Image block: if its own alt is empty, fall back to the library's alt.
5. The picker gains a filter (images only vs all) so the media field kind can take documents.
6. **Design pass:** `/frontend-design` + `/ui-ux-pro-max` on the detail panel and document tiles.

## Step 4 — TYP-01 Type builder (~0.4 d)

1. Schema: a `content_types` table (`siteId`, name, singular name, `prefix`, `fields` JSONB,
   `isBuiltIn`). `content` gains `typeId` (nullable; null = page), `data` JSONB and `authorId`
   (req. 3 author). Entries store `path = prefix/slug`, so `@@unique([siteId, path])` and
   `findLiveByPath` keep working unchanged.
2. `ContentTypeRepository` is site-scoped (invariant 1). CRUD lives under `site:manage`.
3. Seed a built-in **Post** type (`/blog`) for every site with fields: featured image (media),
   excerpt (text). Its core fields are locked. Publication date comes from publish (CNT-03).
4. Admin: a **Types** screen (list, create with name + prefix, edit). Each type gets a nav entry
   that lists its entries, and it shows up straight away (react-query invalidation).
5. **Design pass** on the Types screen and nav.

## Step 5 — TYP-02 Six field kinds (~0.6 d)

1. Field definition: `{ key, label, kind, required, options? }` for kind ∈ text, richText, date,
   media, select, link. The key is generated from the label and locked after creation. Removing a
   field hides it but keeps its data (ARCHITECTURE.md).
2. `api`: a Zod schema built from the type's fields validates `data` on every write. Rich text is
   sanitised (Step 1 helper). Media must belong to the same site. Link must be http/https/mailto or
   a relative path. A seventh kind is a compile error (exhaustive map, same pattern as invariant 4).
3. Admin: a field builder in the Types screen (add, reorder, edit label/required/options). The entry
   editor shows a **Fields** panel generated from the type next to the normal block canvas.
4. **Design pass** on the field builder and Fields panel.

## Step 6 — TYP-03 Type routing (~0.3 d)

1. `/<prefix>/<slug>` renders a published entry: auto entry header (title, author, date, then fields
   in order; media image as hero, document as a download link, link as a button), with the block
   body below. It's a `cms-blocks` component, so it stays colour-agnostic (invariant 2).
2. `/<prefix>` shows a newest-first listing of published entries (title, featured image, excerpt).
3. Both go through the existing catch-all route: no new route files, no deploy.
4. Publishing an entry revalidates its own path **and** `/<prefix>` (CNT-08, host-inclusive).
5. Test with two hosts (invariant 6): kestrel's `/blog` must never list corrick's posts.
6. **Design pass** on the entry header and listing, with two tenant themes.

## Step 7 — TYP-04 Template on create (~0.2 d)

1. The create screen offers Blank plus the four starter layouts as visual cards (`GET /starter-layouts`).
2. The chosen layout's blocks go through the normal content write path (sanitised).
3. A new Post starts from Article.
4. **Design pass** on the card picker.

## Per-ticket finish line (every step)

DoD confirmed with the user before building → tests written → build → reviewer agent → verifier
agent → real-browser check (public pages via curl or headless Chrome; the browser pane blocks
`*.lvh.me`) → WORKLOG + STATUS + ticket file + D-entry.

## Estimate

Merges 0.3 + BLK-05 0.4 + BLK-07 0.3 + MED-04 0.3 + TYP-01 0.4 + TYP-02 0.6 + TYP-03 0.3 + TYP-04 0.2
≈ **2.8 days**. The plan's original week-3 remaining budget is 3.9 d.

## Risks

- **Puck richtext + `contentEditable`** is new to this codebase. The Step 1 spike settles it; if it
  doesn't hold up, fall back to the ticket's own `Editable` primitive (+0.3 d).
- **Prefix vs page-path clashes** and wrong cache keys are the likeliest cross-tenant or 404 bugs.
  Both get explicit tests.
- **Merge drift:** seven branches touching `config.tsx`, `schema.prisma` and `MediaPage.tsx`. Merge
  in the order above and build after each.
