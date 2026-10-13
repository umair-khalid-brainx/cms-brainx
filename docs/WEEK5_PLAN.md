# Week 5 plan (M5)

Drafted 2026-10-12 from a ticket review with the user, after fast-forwarding this branch to the week 4 branch
(`claude/week-4-cms-tickets-d0f656` at `347ba7d`: all ten M4 tickets built). GOV-02's work is still
uncommitted in that worktree and is synced in Step 0. Choices below are the user's answers; the estimates here replace `EXECUTION_PLAN.md`'s for week 5 (D-064); each is tied to the
client's requirements (`docs/REQUIREMENTS.md`, req. N = section N).
When a step lands, the usual doc rules apply (WORKLOG, STATUS, ticket file, DECISIONS).

**Rule for this week:** build what the requirements and tickets ask for, and make it correct. No extras. Every
screen with UI is designed with the `frontend-design` and `ui-ux-pro-max` skills, inside the admin's existing
look (not a restyle). Design-heavy steps are marked 🎨.

## Where week 5 stands

| Ticket | Status | Real state |
|---|---|---|
| GOV-07 | TODO | `ContentStatus` is `draft / published / archived`. No review state, **no scheduling** (req. 1, 8 need it) |
| GOV-08b | TODO | Unblocked: GOV-03/04 built. Kestrel has a theme and a few pages; no logo, menus or real copy |
| DEP-01b | TODO | DEP-01a (week 1) never built: no server, no domain (DEC-2 open). No deploy files in the repo |
| DEP-02 | TODO | `sites.host` holds placeholders (`corrick.yourcms.com`), reserved for custom domains (D-030) |
| DEP-03 | TODO | DEC-3 open. Seed has no images at all (`api/prisma/seed.ts`) |
| DEP-04 | TODO | No demo script exists |
| BLK-03, BLK-04 | IN-PROGRESS | Need the user's hands-on check |
| GOV-02 | built | Uncommitted in the week 4 worktree; reviewer + verifier not run |
| FND-03 | TODO (week 1) | Tenant invariant tests; overlaps GOV-08b's "every leak gets a test" |

## Decisions made in the review

| # | Question | Answer | Requirement served |
|---|---|---|---|
| 1 | Base for week 5 | **Fast-forward onto the week 4 branch now**; sync GOV-02 once it's committed | — |
| 2 | Scheduled publishing | **Inside GOV-07**: approve = publish now or at a date/time; publishers can schedule directly | Req. 1 "schedule", req. 3 "scheduled status", req. 8 |
| 3 | Who reviews | **Owner, Administrator, Editor** (new `content:review` permission). Author keeps publishing directly but can't approve others' work | Req. 7, 8 |
| 4 | Editing while in review | **Locked until reviewed**; the submitter can withdraw it back to draft | Req. 8 |
| 5 | Viewer role | **Add it with GOV-07**: read-only | Req. 7 |
| 6 | Review queue UI | **"Review" sidebar item with a count**, plus an "In review" chip and filter on the Pages list | Req. 8, NFR "user-friendly" |
| 7 | Demo tenants (DEC-3) | **Keep Corrick Oyster Co. and Kestrel Rigging**; DEC-3 resolved as "placeholders kept" | — |
| 8 | Deploy | **Scripts only, tested locally**; run on a real box when DEC-2 lands | — |
| 9 | Production API (DEC-5) | **`api.<domain>`, nginx → `127.0.0.1:4000`** | — |
| 10 | Custom domain on the Domains screen | **Owner can type one; saved, shown as Pending** with DNS records. Not served on it | — |
| 11 | Demo rehearsal | **I write the demo script**, run it 3× on local production builds (scripted browser), user does one run by hand | — |
| 12 | Leftovers | **BLK-03/04 hand check folded into DEP-04's hand run**; GOV-02 finished in its own worktree | — |
| 13 | Demo images | **Free-licensed stock photos** (Unsplash/Pexels), ~20, listed for the user's OK before downloading | Req. 4 |

Defaults I chose without asking (shout if any is wrong):
- **Two new statuses: `in_review` and `scheduled`.** `scheduled` also stores `publishAt`. The public read already
  filters on `status = published`, so neither leaks; every other status filter (`findMany`, counts, sitemap, menus,
  archives, related) is checked and tested.
- **Review fields on `Content`:** `submittedById`, `submittedAt`, `reviewNote` (the last reject's note, cleared on
  resubmit). Not a separate table: one review at a time per page.
- **Who can submit:** anyone with `content:write`. Publishers usually won't need to.
- **Reject needs a note** (1–500 chars). The submitter sees it as a banner in the editor until they resubmit.
- **Approve runs pre-publish validation (CNT-12)**, same as Publish. A scheduled page is validated when scheduled
  **and** again when it fires; if it fails then, it goes back to draft with a note saying why.
- **The scheduler is an in-process timer in `api`, once a minute** (`@nestjs/schedule`). It publishes with one
  conditional update (`WHERE status = 'scheduled' AND publish_at <= now()`), so two `api` processes can't
  publish twice. Then it revalidates and records a `publish` revision, like a manual publish. A page can be at
  most ~1 minute late. Alternative considered: checking on every public read; rejected because ISR would keep
  serving the old 404 until the 60 s timer anyway, and the sitemap/menus would disagree.
- **Times are entered in the browser's time zone and stored as UTC**; the list shows "Scheduled · 14 Oct, 09:00".
- **A scheduled page is locked like an in-review one**; a publisher can "Unschedule" it back to draft, or
  "Publish now".
- **Revisions:** submit, approve, reject, schedule and unschedule each record a `status` revision with who did it
  (req. 8 "previous versions remain available", req. 9 "who made each change").
- **Viewer:** `content:read` and nothing else. Sees Pages and Media and opens a page's preview link, not the editor
  or the Review screen (that is `content:review`). Every write button is hidden, and the API refuses with 403 anyway.
- **Custom domain:** `sites.host` becomes nullable; the seed's fake `*.yourcms.com` values are cleared. A new
  `domainStatus` (`pending | verified`) is shown only; nothing in the app sets `verified` (a person can in the DB
  for the demo). Needs `site:manage`.
- **FND-03 (tenant invariant tests) is folded into GOV-08b**, since the bug hunt writes those tests anyway.
- **DEP-01a's server-side parts (nginx config, pm2 file, TLS notes) are written as files in DEP-01b**; DEP-01a stays
  open until there's a real box.

## Build order and why

`Step 0 → GOV-07 (Viewer → review → schedule) → DEP-02 → GOV-08b (+FND-03) → DEP-03 → DEP-01b → DEP-04`

Features first, so the seed can show a page in review and a scheduled post. DEP-02 is small and touches `sites`,
which GOV-08b's hunt then covers. GOV-08b before DEP-03 because the hunt needs Kestrel's branding and the seed
then rebuilds both tenants for real. Deploy scripts before the rehearsal, so the rehearsal runs on builds made by
those scripts.

Each ticket: confirm its DoD (rewritten in Step 0) → test-writer → build → `api` test + typecheck + lint, `admin`
and `web` build → reviewer → verifier → hand check in the browser → docs.

## Step 0 — Housekeeping (~0.1 d)

- Rewrite the DoD in the six M5 ticket files from this plan; drop the "Draft" markers.
- `EXECUTION_PLAN.md`: DEC-3 resolved (placeholders kept), DEC-5 resolved (`api.<domain>`, port 4000).
- `STATUS.md`: FND-03 note "folded into GOV-08b". DEP-01a note "server parts written in DEP-01b; still needs DEC-2".
- One DECISIONS entry for the week's scope (scheduling and Viewer in GOV-07, FND-03 folded in, scripts-only deploy).
- When GOV-02 is committed in the week 4 worktree: merge that branch here again.

## Step 1 — GOV-07 Review workflow, scheduling, Viewer (~0.9 d, band C)

**1a. Viewer role (~0.1 d)**
- Migration: `viewer` added to `member_role`. `ROLE_PERMISSIONS.viewer = ['content:read']`. New
  `content:review` for owner, administrator, editor.
- Team screen: Viewer in the role picker with a one-line description. Admin hides write actions for it.
- Tests: Viewer gets 403 on every write route (`POST/PATCH/DELETE /content`, media, menus, terms, redirects, settings).

**1b. Submit, approve, reject (~0.4 d)**
- **Schema:** `ContentStatus` gains `in_review`; `Content` gains `submittedById`, `submittedAt`, `reviewNote`.
- **API:** `POST /content/:slug/submit` (`content:write`, from draft), `/withdraw` (submitter or reviewer, back to
  draft), `/approve` (`content:review`, body `{ publishAt? }`, runs CNT-12 checks), `/reject` (`content:review`,
  body `{ note }`). `GET /content/review-queue` (`content:review`) and a count for the badge.
  `PATCH` on an in-review page → 409 "In review: withdraw it to edit".
- **Admin 🎨:**
  - Editor top bar: a contributor sees **Submit for review** instead of Publish; in review it shows a locked banner
    ("Waiting for review since …", Withdraw). After a reject: a banner with the reviewer's note.
  - **Review** screen: rows with title, type, submitted by, when, a link to Preview, and Approve (publish now /
    schedule) and Reject (note dialog). Sidebar item with a count badge, hidden for Author and Contributor.
  - Pages list: "In review" status chip and filter tab.
- **Tests:** every transition and its permission, the lock, the note required, cross-site slug → 404, the public
  site never shows an in-review page (two hosts).

**1c. Scheduling (~0.4 d)**
- **Schema:** `ContentStatus` gains `scheduled`; `Content.publishAt`.
- **API:** `POST /content/:slug/schedule { publishAt }` (`content:publish`, must be in the future, runs CNT-12);
  `/unschedule`; approve with `publishAt` lands here too. Scheduler as in the defaults above; it sets `publishedAt`,
  revalidates (page, listing, archives, sitemap, menus) and records the revision.
- **Admin 🎨:** the Publish button gets a split option "Schedule…" with a date-time picker; scheduled pages show a
  "Scheduled · date" chip in the list and a banner in the editor (Publish now, Unschedule).
- **Tests:** the scheduler with a fake clock (fires once, not early, not twice with two runs at once, a page
  unscheduled before its time stays draft, failed validation goes back to draft with a note); live check: schedule
  2 minutes ahead on a production build and watch `x-nextjs-cache` turn from 404 to the page on two hosts.

## Step 2 — DEP-02 Domains screen (~0.3 d) 🎨

- **Schema:** `sites.host` nullable; `sites.domainStatus` (`pending | verified`, nullable). Seed clears the fake hosts.
- **API:** `GET /sites/current/domain`, `PUT` (`site:manage`): normalises (lower-case, no scheme or path), refuses
  our own root domain and a domain another site uses (409), sets `pending`. `DELETE` removes it.
- **Admin 🎨:** Settings → **Domains**: the free address (`corrick.<root>`, with a copy button, "Active"); the custom
  domain card with its status badge and the two DNS records to add (CNAME `www` → `corrick.<root>`, plus an apex
  note), each copyable; plain-language "what happens next" text. Pending is honest: "Not live yet".
- **Tests:** normalisation, uniqueness across sites, permission, one site can't read another's domain.

## Step 3 — GOV-08b Second tenant + cross-tenant bug hunt (~0.8 d, band D)

- **Kestrel branding:** logo, tagline, footer note, header and footer menus, five or so pages (Home, About, Services
  with two child pages, Contact with the form), using GOV-03/04. Written into the seed in Step 4; built here by hand
  first to find bugs.
- **Hunt, written as a repeatable script** (`api/test/cross-tenant.e2e-spec.ts`): log in as each tenant's owner and
  call every admin route with the other tenant's slugs and ids (content, revisions, media, terms, menus, redirects,
  submissions, types, members, preview links, domain), expecting 404/403. Public: every public route on both hosts
  (pages, nested pages, listings, archives, related, sitemap, robots, redirects, preview tokens, form submit) must
  show only its own data. ISR: a refresh on one host leaves the other's cache HIT (invariant 6).
- **FND-03:** the same spec plus a static check that nothing outside a repository imports `PrismaService`
  (invariant 1).
- Every leak found: fixed, with its own test, and listed in WORKLOG.

## Step 4 — DEP-03 Realistic seed content (~0.8 d)

- **Images:** ~20 photos (oysters, coast, kitchen; rigging, cranes, crew). I list each one's source and license for
  the user's OK **before downloading**. Stored under `api/prisma/seed-media/`, uploaded by the seed through the same
  path as MED-01 (thumbnails, alt text, titles).
- **Corrick:** Home, About, Wholesale, Visit, Contact, a blog with ~6 posts across 3 categories and tags, one page in
  review and one post scheduled for next week (shows GOV-07). **Kestrel:** what Step 3 built, plus a projects
  type or a news blog of ~4 entries.
- Menus, branding, SEO fields filled on key pages, a redirect from an old URL.
- **Repeatable:** `npx prisma migrate reset --force && npm run db:seed` (in `api/`; the seed is not wired into reset, FND-06) on an empty database gives the same result; the seed is idempotent
  (re-running doesn't duplicate). Copy is judged by the user.

## Step 5 — DEP-01b Deploy script and rollback (~1.0 d, band E)

- **Files:** `deploy/` at the repo root: `deploy.sh`, `rollback.sh`, `ecosystem.config.cjs` (pm2: `api` on 4000,
  `web` on 3000), `nginx/cms.conf` (`*.<domain>` → web, `admin.<domain>` → admin static, `api.<domain>` → api,
  `X-Forwarded-For` overwritten with `$remote_addr`), `env.example` listing every production variable (including
  `API_PUBLIC_URL`, `WEB_REVALIDATE_URL`, `REVALIDATE_SECRET`, `FORM_SUBMIT_SECRET`), `README.md`.
- **Deploy:** one command builds a release into `releases/<timestamp>/` (cms-blocks → api → web → admin), runs
  `prisma migrate deploy`, switches a `current` symlink, `pm2 reload`, checks a health URL, and rolls back
  automatically if it fails. Keeps the last 5 releases.
- **Rollback:** `rollback.sh` points `current` at the previous release and reloads. Migrations are forward-only, so
  the README says plainly that a rollback across a migration needs that migration to be backward-compatible.
- **B-08:** `npm audit` revisited for all three apps; the result recorded.
- **Tested locally:** deploy into a scratch folder on this Mac with pm2 and a second database; a deliberately broken
  release rolls back by itself; `rollback.sh` returns to the previous one.

## Step 6 — DEP-04 Demo script, rehearsal, bug fixing (~1.5 d, band D)

- `docs/DEMO_SCRIPT.md`: a 20-minute walk through the ten requirement areas on both tenants (create from a layout,
  blocks and rich text, media, blog with categories, SEO and sitemap, menus and branding, roles and review, schedule,
  history and compare, redirects, domains), with what to click and what to say.
- 3 scripted runs on local production builds made by `deploy.sh`; every bug fixed or written into BACKLOG.
- One run by the user, by hand. This is also the hands-on check for BLK-03 and BLK-04.

## Estimate

| Step | Days |
|---|---|
| 0 Housekeeping | 0.1 |
| 1 Review, scheduling, Viewer | 0.9 |
| 2 Domains | 0.3 |
| 3 Second tenant + hunt | 0.8 |
| 4 Seed content | 0.8 |
| 5 Deploy scripts | 1.0 |
| 6 Demo and rehearsal | 1.5 |
| **Total** | **~5.4 d** |

Slightly over a 5-day week. If it runs late, trim in this order: Kestrel's extra entry type (Step 4), then the third
scripted rehearsal (Step 6).

## Not in this week (explicitly)

- Real server, domain, TLS (DEC-2). Serving a site on its custom domain; DNS verification.
- Email or in-app notifications for review requests.
- Multi-step approval, per-author ownership ("only my own pages"), review comments threads.
- A super-admin panel (D-014).
