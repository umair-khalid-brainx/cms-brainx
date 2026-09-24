# Backlog

Ad-hoc fixes, off-main-flow requests, feedback and ideas. Scheduled feature work lives in
`EXECUTION_PLAN.md`; this file exists so small asks do not get lost.

Status: **open** / **done** (with date) / **accepted** (deliberately not acting).

---

## Open

| # | Item | Raised | Notes |
| - | ---- | ------ | ----- |
| B-01 | **Docs are unversioned.** `CMS/` is not a git repo, so `CLAUDE.md` and `docs/` are not tracked. Options: make `CMS/` a docs-only repo that gitignores `api/ web/ admin/`, or create a separate `cms-docs` repo. | 2026-08-31 | Needs owner's call — a root repo technically contains the three project folders on disk, which may read against the three-repo decision (D-001) |
| B-02 | **Scope doc §11 says "22-day / 4.5-week commitment"** while every other figure says 25 days / ~5 weeks. Leftover from Revision 1. | 2026-08-31 | Fix in the source `.docx` |
| B-03 | **Scope doc block count reads as a contradiction** — §5 lists 11 blocks (form included), §6 prices "10 shared block components" plus the form block separately. Numerically consistent, confusing as written. | 2026-08-31 | Reword to "10 blocks + form block" |
| B-04 | **Commit the three repos.** All on `master` with zero commits; nothing is recoverable if a file is lost. | 2026-08-31 | Waiting on owner — no commits made without asking |
| B-05 | **`api/.agents/` holds 424 KB of Prisma's own agent skill docs**, added by `prisma init`. Keep or delete. | 2026-08-28 | Empty `.claude/` and `.windsurf/` dirs it also created were removed; `prisma generate` recreates them |
| B-06 | **Device-width preview toggle in the editor** (desktop / tablet / mobile) becomes nearly free once the canvas is in an iframe, since `@media` measures the iframe. | 2026-08-31 | Good pitch moment; fold into `BLK-03` if cheap, otherwise a new ticket |
| B-07 | **Delete the dev-only routes** `/` comparison view and `/preview/[site]` once the real host-resolved catch-all route lands. | 2026-08-31 | Tie to `CNT-07` |

## Accepted — deliberately not acting

| # | Item | Decided | Reasoning |
| - | ---- | ------- | --------- |
| B-08 | `npm audit` reports 5 findings in `api` dev-only transitive deps (`tmp` via the Nest CLI, `undici`). | 2026-08-28 | Dev tooling only, and `audit fix --force` would take breaking major bumps on a fresh scaffold. Revisit before deploy (`DEP-01b`) |
| B-09 | Stale cached 308 redirect from `localhost:3000` to `/en`, left by an unrelated project on that origin. | 2026-08-31 | Not a bug in this project. Workaround: use `127.0.0.1:3000`, or clear site data with "unregister service workers" |

## Done

_Nothing shipped from this list yet._
