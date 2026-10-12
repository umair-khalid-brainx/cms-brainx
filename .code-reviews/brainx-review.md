---
diff_hash: 0cdcb8c414a6efe548a65374aa058d01fddc89b6ad949b68ce4fa478e043c8e6
reviewed_at: 2026-10-12T16:02:33Z
---

## Summary

GOV-01: page and entry revisions. `api` adds a `revisions` table (migration + `Revision` model; `site_id`, `content_id`
cascade, `author_id` SetNull, index `(content_id, created_at desc)`), `RevisionRepository` (every method `siteId`-scoped;
insert + prune beyond 50 in one `$transaction`; in-place `overwrite` via `updateMany`), pure rules in `revision-rules.ts`
(`reasonForSave`, `decideRecording` with a 10-minute same-author autosave window, key-order-insensitive `snapshotsEqual`,
`splitRestorableTerms`), and `RevisionsService` + `RevisionsController` (`GET /content/:slug/revisions`, `GET .../:id`,
`POST .../:id/restore`). `ContentService.update` records a revision of the page as it now is, after the write, inside
`afterWrite` so a failure never fails the save. Restore keeps status and address, records `before_restore` first, re-sanitises
blocks, normalises SEO via `readSeo`, drops terms deleted since (reported as `droppedTerms`), needs `content:publish` for a
live page and holds a live page to the publish checks (`ContentService.publishChecksFor`, passed in as a callback to avoid a
service cycle), then revalidates page, listing and (when terms changed) the site. `admin` adds a History panel (native modal
`<dialog>`, grouped by day, nested confirm dialog), `revisions.ts` helpers with tests, `revisionsApi.ts`, and editor wiring
that flushes pending edits before listing/restoring and remounts Puck from the re-read page after a restore. Docs (D-062),
tickets and the previous review file's deletion are staged.

Stacks: no root marker (three independent projects, D-012). Reviewed `api/` as NestJS (nestjs.md) and `admin/` as React
(react.md). One git repository, so one review.

Cross-project contract check: `api`'s list rows (`id, createdAt, reason, status, title, author{id,name}|null`) match
`admin`'s `RevisionSummary`; restore's `{restored, from{id,createdAt}, droppedTerms[{name,kind}]}` matches `RestoreResult`.
Tenant scoping holds: revisions are read by `siteId` + `contentId` + `id`, terms by `findByIds(siteId, …)`, and the page by
the caller's membership. Field kinds are immutable (`field-definitions.ts`), so writing stored `data` back unparsed is safe.

Verified: `api` vitest `src/revisions` + `content.service.spec.ts` 157/157 pass; `admin` `revisions.test.ts` 12/12 pass;
`admin` `tsc -b` clean.

## Findings

### Critical (0)

### High (0)

### Medium (1)
- **admin/src/pages/EditorPage.tsx:190** — After a restore whose re-read fails, `staleAfterRestoreRef` only blocks `handleChange`; `publishNow` still sends `latestDataRef.current`, which holds the pre-restore content, through `saveDraft` and `publishPage`. *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: `handleRestored` sets `staleAfterRestoreRef.current = true` and, when `getPage` fails or returns null, leaves it set and shows "Reload this page before editing". The Publish button stays enabled, and `publishNow` (and Puck's wired `onPublish`) never checks the flag. One click writes the old editor content over the restore and publishes it. The restore is lost from the page; it survives only as a revision. Fix: return early from `publishNow` (and disable the button) while `staleAfterRestoreRef.current` is true, or move the guard into a shared "can write" check that `publishNow` and `flushPending` both use.

### Low (3)
- **api/src/revisions/revisions.service.ts:143** — A restore whose term is deleted between `findByIds` and the write fails on the FK with Prisma `P2003` and surfaces as a 500. `ContentService.update` maps the same race to a 409 "A category or tag was just deleted". *(consistency)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: `content.update(siteId, slug, …, links)` runs `contentTerm.createMany` inside its transaction. A term removed in that window violates the FK, the transaction rolls back (so no data corruption), but the error is uncaught and the admin shows the generic "Couldn't restore" after a 500. A `before_restore` row has already been written. Catch `P2003` when `links` is set and throw the same `ConflictException` as `update()`.
- **api/src/revisions/revisions.service.ts:108** — `checkLive` is optional, so `restore()` silently skips the live-page publish checks for any caller that doesn't pass it. *(maintainability)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: D-062 makes "a live page is held to the publish checks" a rule, but the service only enforces it when the controller remembers to supply the callback. Today the controller always does. A future caller (a bulk restore, a GOV-02 "restore from compare" route) could leave it out and nothing would fail. Make the parameter required, or inject the checks behind a small interface/token so the rule can't be skipped.
- **api/src/revisions/revision.repository.ts:67** — An autosave overwrite replaces the row's content but keeps its `createdAt`, so the History list labels a version with the time of the first save in its 10-minute window while it holds the state of the last one. *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: "Restore the version from 10:00" can restore content saved at 10:09. Keeping `createdAt` fixed is what anchors the window (bumping it would let continuous editing extend one row forever), so the fix is not to bump it. Instead, add an `updated_at` (`@updatedAt`) column and show that time in the list and confirm. Or document in the panel that an autosave row holds the latest state within its window. The order of the list is unaffected because only the latest row is ever overwritten.

## Reviewed files
- .code-reviews/brainx-review.md (deletion of previous review)
- admin/src/components/HistoryPanel.css
- admin/src/components/HistoryPanel.tsx
- admin/src/lib/revisions.test.ts
- admin/src/lib/revisions.ts
- admin/src/lib/revisionsApi.ts
- admin/src/pages/EditorPage.tsx
- api/prisma/migrations/20261012170000_add_revisions/migration.sql
- api/prisma/schema.prisma
- api/src/content/content.module.ts
- api/src/content/content.service.spec.ts
- api/src/content/content.service.ts
- api/src/revisions/revision-rules.spec.ts
- api/src/revisions/revision-rules.ts
- api/src/revisions/revision-test-kit.ts
- api/src/revisions/revision.repository.ts
- api/src/revisions/revisions.controller.ts
- api/src/revisions/revisions.service.spec.ts
- api/src/revisions/revisions.service.ts
- docs/BACKLOG.md (skimmed)
- docs/DECISIONS.md (D-062 read in full)
- docs/WORKLOG.md (skimmed)
- tickets/GOV-01.md (skimmed)
- tickets/STATUS.md (skimmed)
- tickets/TAX-02.md (skimmed)
