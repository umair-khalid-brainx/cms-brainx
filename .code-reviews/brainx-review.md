---
diff_hash: 261af8524e17127747c4d0814e05e7d834cbf1052dbbdbb18cb34835ce7ded44
reviewed_at: 2026-10-09T14:56:09Z
---

## Summary

TYP-04 review follow-ups, closing the ticket. `admin`: the create screen now sends a layout only if it was in the
loaded list (a new Post no longer asks for `article` when the layouts failed to load); the hidden radio's selector is
raised to beat `.create-page-form input` and drops padding/border; the radiogroup is named by the fieldset legend via
`aria-labelledby` instead of a second `aria-label`. `api`: `createContentSchema.layout` gains `.max(64)`, with a new
Zod spec. Docs: WORKLOG, STATUS and TYP-04 marked done. Also stages a new `.claude/launch.json`.

Stacks: no root `package.json` (three independent projects); `api/` reviewed as NestJS, `admin/` as React. Single
repo, so the admin/api contract was checked together: admin only sends keys from `GET` starter layouts, which are
seeded short keys, well inside the new 64-char limit. Verified: `api` `npm test` 20 files / 354 tests pass (matches
the WORKLOG claim); `admin` typecheck clean; `admin` lint shows only pre-existing warnings in unrelated files.

## Findings

### Critical (0)

### High (0)

### Medium (1)
- **.claude/launch.json:1** — A worktree-local preview config is being committed to the shared repo. Its ports
  (`api-spike` 4021, `admin-spike` 5191, `web-spike` 3030) only match this worktree's gitignored `api/.env`
  (`API_PORT=4021`, `CORS_ORIGINS` on 5191) and `admin/.env.local`; nothing committed sets them. On `main` or any
  fresh clone, `api` listens on `API_PORT` from `.env` (4001 per CLAUDE.md / 4000 default), so the `api-spike` entry
  waits on 4021 forever, and an admin on 5191 is refused by the default `CORS_ORIGINS` (5173). It is also unrelated
  to TYP-04 and was swept in by `git add -A`. *(consistency)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Unstage it (`git restore --staged .claude/launch.json`) and keep it local — e.g. add
    `.claude/launch.json` to the root `.gitignore` — or, if a shared launch config is wanted, commit one that uses
    the documented ports (4001 / 5173 / 3000) and env-driven values. No functional effect on the app itself, hence
    Medium rather than High.

### Low (1)
- **admin/src/pages/CreatePagePage.tsx:28** — When `layout` holds a key that isn't in the loaded list (a Post's
  preselected `article` after that seeded layout is renamed or removed), `startFrom` now correctly sends nothing, but
  the picker still renders with no card checked — Blank's `checked` is `layout === ''` — so the screen shows no
  selection while the page will be created blank. *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Derive the checked value from the same rule as `startFrom` (e.g. pass `checked={(startFrom ?? '')
    === option.key}` / `startFrom === undefined` for Blank), so what's shown is what gets sent. Edge case only — the
    four seeded layouts include `article` today.

## Reviewed files
- .claude/launch.json
- admin/src/pages/CreatePagePage.css
- admin/src/pages/CreatePagePage.tsx
- api/src/content/dto/content.dto.spec.ts
- api/src/content/dto/content.dto.ts
- docs/WORKLOG.md (docs; checked against code and test run)
- tickets/STATUS.md (docs; totals checked: 31 + 2 + 22 + 1 = 56)
- tickets/TYP-04.md (docs)

Context used: `api/src/content/content.service.ts` (consumes `dto.layout`), `api/prisma/schema.prisma`
(`StarterLayout.key` has no DB length limit), `api/src/main.ts` (port resolution), `admin/vite.config.ts`
(`strictPort` 5173), root `.gitignore`.
