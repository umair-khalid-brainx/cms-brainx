---
diff_hash: 05d56220655938a60715cce16cd5e64c8bd10a720fefc27327729fb5d57449f4
reviewed_at: 2026-10-12T17:49:08Z
---

## Summary

GOV-07: review workflow, scheduling and the Viewer role, across `api`, `admin` and `web`.

- **api:** new `in_review`/`scheduled` statuses, workflow columns on `content` and a migration. A `WorkflowService`
  handles submit, withdraw, approve, reject, schedule, publish-now and unschedule. Each step is one conditional
  `updateMany` (`ContentRepository.transition`). A once-a-minute `ScheduledPublisher` timer publishes due pages.
  There is a new `content:review` permission and a `viewer` role. While a page is in review or scheduled,
  `ContentService.update` and revision restore are locked (409), and saves to a live page now need `content:publish`.
  Media replace and alt-text edits on a file used by a live, in-review or scheduled page also need `content:publish`.
  `refreshPublic` was pulled out of `update` so the workflow can reuse it.
- **admin:** workflow strip, When and Send-back dialogs, Review screen with a nav badge, an "In review" tab, read-only
  editor and media for Viewers and locked pages, role descriptions on Team.
- **web:** the preview banner covers the two new statuses.

Stack: the repo root has no `package.json` (three independent projects, D-012). `api/` is NestJS
(`resources/nestjs.md`); `admin/` and `web/` are React (`resources/react.md`).

Cross-repo contract check: admin's `ContentRecord`/`Page` fields (`publishAt`, `reviewNote`, `submittedById`,
`submittedAt`, `reviewedAt`, `submittedBy`/`reviewedBy`/`scheduledBy`) match what `getForEdit` and the workflow
routes return. `ReviewItem` matches `findInReview`'s `select`. Web's `PreviewPage.status` union matches api's.
Admin's `canReviewContent`/`canWriteContent` match `ROLE_PERMISSIONS`. No mismatch found.

Checked and fine: every write route in every controller needs more than `content:read`, so a Viewer can write
nothing. `planMove` still refuses a non-publisher moving a draft with live children. `remove` only deletes
archived pages, so it can't delete a page in review or scheduled. `RevalidationService` swallows its own errors, so
`refreshPublic` can't abort the scheduler's loop. `publishChecksFor` includes required fields. Adding enum values
inside the migration's transaction is safe because none of them is used in the same transaction.

## Findings

### Critical (0)

### High (0)

### Medium (1)
- **api/src/content/workflow.service.ts:70** — Approve doesn't tie the decision to the version the reviewer actually read, so a withdrawn, edited and resubmitted page can go live without anyone reviewing it. *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: `approve` reads the page itself and passes its own `page.updatedAt` as `unchangedSince`. That only stops
    a change made between the server's read and its write, a few milliseconds. The approve body (`approveSchema`) and
    `approvePage()` in `EditorPage.tsx:470` send no version, so the server can't know which version the reviewer saw.
    Example: a reviewer opens version A in the editor (read-only, locked). Meanwhile the Contributor withdraws it,
    edits it to version B and resubmits. The reviewer, still looking at A, clicks Approve → Publish now. B passes the
    checks and goes live, and nobody reviewed it. That breaks the rule this lock exists for (D-065; `lockedBecause`:
    "the reviewer approves exactly what was submitted"). The comment at line 77 says it covers exactly this case
    ("not one withdrawn, edited and resubmitted meanwhile"), but it only covers it inside the server request. Fix:
    have the editor send the `updatedAt` (or `submittedAt`) it loaded, and pass that to `transition` as
    `unchangedSince`. If it doesn't match, the API answers with the existing `PAGE_CHANGED` 409. Reject probably
    needs the same, so a note isn't attached to a version the reviewer never saw.

### Low (1)
- **api/src/content/content.controller.ts:62** — `GET /content/review-queue` hides any page or entry whose slug is `review-queue`. *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: The static route is declared before `@Get(':slug')`, so `GET /content/review-queue` always goes to the
    queue. `slugProblem` only rejects `RESERVED_PREFIXES` (`admin`, `api`, `preview`, …), and that list doesn't include
    `review-queue`. So a user can create a page with that slug (e.g. a "Review Queue" page) and then can't open it in
    the editor. A reviewer gets the queue JSON instead of the page; a Contributor gets 403 from the
    `content:review` guard. The existing `archived` route has the same problem, so this diff adds a second case rather
    than starting one. Fix: reserve both words for content slugs, or move the collection routes off the `:slug`
    namespace (e.g. `/content/_review-queue`; no slug can start with `_`).

## Reviewed files
- CLAUDE.md
- admin/src/App.tsx
- admin/src/components/HistoryPanel.tsx
- admin/src/components/MediaDetailsForm.tsx
- admin/src/components/PublishChecksPanel.tsx
- admin/src/components/SendBackDialog.tsx
- admin/src/components/WhenDialog.tsx
- admin/src/components/WorkflowStrip.css
- admin/src/components/WorkflowStrip.tsx
- admin/src/layouts/AdminLayout.css
- admin/src/layouts/AdminLayout.tsx
- admin/src/lib/RequireWrite.tsx
- admin/src/lib/contentApi.ts
- admin/src/lib/revisions.test.ts (not reviewed: test file)
- admin/src/lib/revisions.ts
- admin/src/lib/roles.ts
- admin/src/lib/workflow.test.ts (not reviewed: test file)
- admin/src/lib/workflow.ts
- admin/src/pages/DashboardPage.tsx
- admin/src/pages/EditorPage.tsx
- admin/src/pages/MediaPage.tsx
- admin/src/pages/PagesListPage.css
- admin/src/pages/PagesListPage.tsx
- admin/src/pages/ReviewPage.css
- admin/src/pages/ReviewPage.tsx
- admin/src/pages/TeamPage.css
- admin/src/pages/TeamPage.tsx
- api/.env.example
- api/prisma/migrations/20261012171511_add_review_and_scheduling/migration.sql
- api/prisma/schema.prisma
- api/src/app.module.ts
- api/src/auth/permission.spec.ts (not reviewed: test file)
- api/src/auth/permission.ts
- api/src/content/content.controller.ts
- api/src/content/content.module.ts
- api/src/content/content.repository.ts
- api/src/content/content.service.spec.ts (not reviewed: test file)
- api/src/content/content.service.ts
- api/src/content/dto/workflow.dto.spec.ts (not reviewed: test file)
- api/src/content/dto/workflow.dto.ts
- api/src/content/workflow-rules.spec.ts (not reviewed: test file)
- api/src/content/workflow-rules.ts
- api/src/content/workflow.service.spec.ts (not reviewed: test file)
- api/src/content/workflow.service.ts
- api/src/media/media.service.spec.ts (not reviewed: test file)
- api/src/media/media.service.ts
- api/src/public/public.service.ts
- api/src/revisions/revision-rules.ts
- api/src/revisions/revision.repository.ts
- api/src/revisions/revisions.service.spec.ts (not reviewed: test file)
- api/src/revisions/revisions.service.ts
- api/src/scheduler/scheduled-publisher.spec.ts (not reviewed: test file)
- api/src/scheduler/scheduled-publisher.ts
- api/src/scheduler/scheduler.module.ts
- api/src/sites/site.repository.ts
- api/src/team/dto/membership.dto.ts
- api/vitest.config.e2e.ts
- docs/BACKLOG.md (not reviewed: docs only)
- docs/DECISIONS.md (not reviewed: docs only)
- docs/WORKLOG.md (not reviewed: docs only)
- tickets/GOV-07.md (not reviewed: docs only)
- tickets/STATUS.md (not reviewed: docs only)
- web/src/app/preview/[subdomain]/[token]/page.tsx
- web/src/lib/publicApi.ts
