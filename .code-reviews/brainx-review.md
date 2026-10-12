---
diff_hash: 13fffcbc5e3cd5c96b52a4d9cb34985f30215bfe347a9737b0be9bb77deddbd3
reviewed_at: 2026-10-12T10:01:48Z
---

## Summary

GOV-05: per-site redirects, made automatically when a page that was ever published moves, and added or deleted by
hand on a new Redirects screen (D-055).

- **api** (NestJS + Prisma): new `redirects` table (`site_id`, `from_path`, `to_path`, `source` enum
  `manual|auto`, unique `(site_id, from_path)`, cascade on site, set-null on creator). Pure rules in
  `redirect-rules.ts` (path normalisation, target validation, `planRedirect` that flattens chains and refuses
  loops). `RedirectRepository.change` applies a whole-list plan under a per-site advisory lock, re-reads page paths
  inside the transaction and always drops a redirect from an address a page has. `RedirectsService` +
  `RedirectsController` (`GET` at `content:read`, `POST`/`DELETE` at `content:publish`). `ContentService` calls
  `pathTaken` after create/duplicate and `pagesMoved` after a move, both through `afterWrite`, which logs instead of
  failing the already-committed page write. `planMove` now carries `everPublished`. Public `GET
  /public/sites/:subdomain/redirect?path=`.
- **web** (Next.js): after no page and no listing answers, asks for a redirect and answers with
  `permanentRedirect` (308).
- **admin** (React): Redirects page (list, add form, delete), nav item, route, and the live-page warnings in Page
  settings now say the old address will redirect.

Cross-project contract check: `web`'s `getRedirect` expects `{ to }` / 404, which matches
`PublicService.getRedirect`; `admin`'s `Redirect` type matches `RedirectsService.list`'s mapped shape, and the
create response (raw Prisma row) carries the `fromPath`/`toPath` the page reads. No mismatch found.

Stacks: api → NestJS, admin → React, web → Next.js (React criteria applied). Specs reviewed for intent, not
line-by-line.

## Findings

### Critical (0)

### High (0)

### Medium (1)
- **api/src/redirects/redirect.repository.ts:500** — `change()` runs `$transaction` with Prisma's defaults (2 s
  maxWait, 5 s timeout) although it waits on a per-site advisory lock first; `ContentRepository` deliberately
  passes `TREE_TRANSACTION` for exactly this reason ("waiting for the site's tree lock counts against the
  transaction's time"). *(consistency / correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Several moves or page creates on one site in quick succession each queue a `change()` behind the
    same lock. Once the wait passes 5 s the transaction times out (P2028). For `pagesMoved`, `afterWrite` swallows
    the error and only logs it, so a published page's old address silently gets no redirect — while the editor
    has just told the user "Its old address will send visitors to the new one". Pass the same kind of explicit
    `{ maxWait, timeout }` the tree transactions use (or share the constant).

### Low (4)
- **api/src/content/content.repository.ts:43** — `findByPath` is added but nothing calls it; `RedirectRepository.change`
  reads page paths itself. *(maintainability)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Dead code on a repository that invariant 1 keeps deliberately small. Remove it, or use it.
- **api/src/redirects/redirects.service.ts:645** — `create` re-reads the new row after the transaction and
  asserts it with `!`. A concurrent `pathTaken`/`pagesMoved` (a page created at that address in between) can delete
  it first, so the endpoint answers 201 with an empty body. *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: The admin page then reads `created.fromPath` on `null`, throws, and shows "Couldn't add the
    redirect" for a request that did succeed and was then correctly overridden. Narrow window; return the row from
    inside the transaction, or throw a clear 409 when the re-read is null.
- **admin/src/pages/RedirectsPage.tsx:58** — after a successful `createRedirect`, the list re-read
  (`await listRedirects()`) shares the same `try`; if only the re-read fails, the user is told the redirect could
  not be added. *(correctness / UX)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Retrying then fails with "already redirects somewhere. Delete that redirect first.", which is
    confusing. Clear the form / announce success before the re-read, or catch the re-read separately.
- **api/src/redirects/redirect.repository.ts:506** — every `change()` (which now runs after every page create and
  duplicate via `pathTaken`, even when no redirect exists at that path) loads every content path on the site and
  writes changed rows with one `upsert` per row. *(efficiency)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Fine at demo scale, but it is a full-site scan plus a lock on the hot path of page creation. A
    cheap early exit in `pathTaken` (skip when `findByFrom` finds nothing) avoids most of it.

## Reviewed files
- admin/src/App.tsx
- admin/src/components/PageSettingsPanel.tsx
- admin/src/layouts/AdminLayout.tsx
- admin/src/lib/redirectsApi.ts
- admin/src/pages/RedirectsPage.css (skimmed)
- admin/src/pages/RedirectsPage.tsx
- api/prisma/migrations/20261012120000_add_redirects/migration.sql
- api/prisma/schema.prisma
- api/src/content/content.module.ts
- api/src/content/content.repository.ts
- api/src/content/content.service.spec.ts (skimmed)
- api/src/content/content.service.ts
- api/src/content/page-tree.spec.ts (skimmed)
- api/src/content/page-tree.ts
- api/src/public/public.controller.ts
- api/src/public/public.service.spec.ts (skimmed)
- api/src/public/public.service.ts
- api/src/redirects/dto/redirect.dto.ts
- api/src/redirects/redirect-rules.spec.ts (skimmed)
- api/src/redirects/redirect-rules.ts
- api/src/redirects/redirect.repository.ts
- api/src/redirects/redirects.controller.ts
- api/src/redirects/redirects.service.spec.ts (skimmed)
- api/src/redirects/redirects.service.ts
- web/src/app/sites/[subdomain]/[[...path]]/page.tsx
- web/src/lib/publicApi.ts
- docs/DECISIONS.md, docs/WORKLOG.md, tickets/GOV-05.md, tickets/STATUS.md (docs, checked against code)
- .code-reviews/brainx-review.md (previous review, deleted in this diff — skipped)
