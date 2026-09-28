# Backlog

Ad-hoc fixes, off-main-flow requests, feedback and ideas. Scheduled feature work lives in
`EXECUTION_PLAN.md`; this file exists so small asks do not get lost.

Status: **open** / **done** (with date) / **accepted** (deliberately not acting).

---

## Open

| # | Item | Raised | Notes |
| - | ---- | ------ | ----- |
| B-02 | **Scope doc §11 says "22-day / 4.5-week commitment"** while every other figure says 25 days / ~5 weeks. Leftover from Revision 1. | 2026-08-31 | Fix in the source `.docx` |
| B-03 | **Scope doc block count reads as a contradiction** — §5 lists 11 blocks (form included), §6 prices "10 shared block components" plus the form block separately. Numerically consistent, confusing as written. | 2026-08-31 | Reword to "10 blocks + form block" |
| B-05 | **`api/.agents/` holds 424 KB of Prisma's own agent skill docs**, added by `prisma init`. Keep or delete. | 2026-08-28 | Empty `.claude/` and `.windsurf/` dirs it also created were removed; `prisma generate` recreates them |
| B-06 | **Device-width preview toggle in the editor** (desktop / tablet / mobile) becomes nearly free once the canvas is in an iframe, since `@media` measures the iframe. | 2026-08-31 | Good pitch moment; fold into `BLK-03` if cheap, otherwise a new ticket |
| B-07 | **Delete the dev-only routes** `/` comparison view and `/preview/[site]` once the real host-resolved catch-all route lands. | 2026-08-31 | Tie to `CNT-07` |
| B-11 | **No "transfer ownership" flow.** A site's Owner is now permanent — `TeamService` refuses to change an Owner's role or promote anyone else to Owner (`DECISIONS.md` D-024) — so there's currently no way to hand a site to a different real owner short of direct DB access. | 2026-09-25 | Real gap for a production system, not needed yet for this POC |
| B-12 | **Uploaded media has no library.** `POST /media` (D-025) stores files and serves them back, but there's no grid of previously-uploaded files, no reuse/replace/delete UI, and no thumbnailing — every upload is a brand-new file, reuse only works by hand-copying a returned URL into another field. | 2026-09-28 | Tracks `MED-02`/`MED-03` |

## Accepted — deliberately not acting

| # | Item | Decided | Reasoning |
| - | ---- | ------- | --------- |
| B-08 | `npm audit` reports 5 findings in `api` dev-only transitive deps (`tmp` via the Nest CLI, `undici`). | 2026-08-28 | Dev tooling only, and `audit fix --force` would take breaking major bumps on a fresh scaffold. Revisit before deploy (`DEP-01b`) |
| B-09 | Stale cached 308 redirect from `localhost:3000` to `/en`, left by an unrelated project on that origin. | 2026-08-31 | Not a bug in this project. Workaround: use `127.0.0.1:3000`, or clear site data with "unregister service workers" |

## Done

| # | Item | Done | Notes |
| - | ---- | ---- | ----- |
| B-01 | Docs were unversioned. | 2026-09-24 | Resolved by folding `api`/`web`/`admin` into one repo at `CMS/` root — see `DECISIONS.md` D-012 |
| B-04 | Commit the three repos. | 2026-09-24 | Superseded by B-01's fix — one repo, one initial commit, instead of three |
| B-10 | Dashboard "Visit Site" link (opens `web`'s preview of the current site in a new tab) and a basic `/settings` screen (site identity fields, read-only account info). | 2026-09-25 | Ad-hoc, no `EXECUTION_PLAN.md` ticket covers a site-settings screen. Settings form doesn't persist — no settings API exists |
