---
diff_hash: 42060be8d505c684cc0332422cf73a6b1b65f873428d4b021618854e9616d79c
reviewed_at: 2026-10-12T16:28:32Z
stack: unknown at repo root (no package.json); React criteria applied to admin/
---

## Summary

GOV-02: a Compare screen for page versions (`/editor/:slug/compare?from=&to=`).

- **admin**: new pure module `lib/diffBlocks.ts` aligns two block lists in three LCS passes (exact block, then
  type + main text, then type alone), reports prop-level and word-level changes, and diffs title, field values,
  SEO and categories/tags. `ComparePage.tsx` shows the result, with a Restore button for the older side. The
  restore confirm moved out of `HistoryPanel` into a shared `RestoreConfirm.tsx`; the History panel gains a
  Compare link per version. `revisionsApi.ts` adds `getRevision` and `getCurrentPage`. `EditorPage` now shows a
  restore notice passed in navigation state and keeps a render-safe `editorStale` flag for the Publish button.
- **docs/tickets**: D-063, worklog, backlog and GOV-02 status.
- **Also staged:** 174 vitest cache files under a root-level `node_modules/`.

Checked: `npx vitest run src/lib/diffBlocks.test.ts` passes (25 tests), and `npm run typecheck` in admin is clean.
The API already has `GET /content/:slug/revisions/:id` (`api/src/revisions/revisions.controller.ts`), so the
contract the new client calls exists. No API change is in this diff.

## Findings

### Critical (0)

### High (0)

### Medium (2)
- **node_modules/.vitest-cache/005dfe3217882b20c9076283879adc48f8fa8c89:1** — 174 vitest cache files (`node_modules/.vitest-cache/*`, `node_modules/.vite/vitest/*`) at the repo root are staged for commit *(maintainability)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: The root has no `package.json` and `node_modules` has never been committed. These files came from running vitest from the repo root. The root `.gitignore` doesn't list `node_modules/`, so `git add -A` picked them up. If committed, they will change on every test run. Fix: `git rm -r --cached node_modules` and add `node_modules/` to the root `.gitignore`.
- **admin/src/lib/diffBlocks.ts:460** — The SEO diff shows a false "Hidden from search engines: (empty) → No" between a version saved before SEO was ever set and one saved after *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: `Content.seo` defaults to `{}` (`schema.prisma:152`). Saving SEO settings, or restoring any revision (`readSeo` in `revisions.service.ts:153`), stores the full object with `noindex: false`. `describeValue(undefined)` is `null` but `describeValue(false)` is `"No"`, so `diffRecord` reports a change that didn't happen. The same mismatch hits optional boolean block props such as `ordered` (absent vs `false`) in `diffProps`. Fix: fill SEO with its defaults on both sides before diffing, or treat `false` like empty for an optional boolean.

### Low (3)
- **admin/src/lib/diffBlocks.ts:373** — A block can be labelled "Formatting or links: changed" when only an empty prop appeared or disappeared, or when only a derived prop differs *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: `diffProps` treats `''`, `null` and a missing prop as equal, and it skips `provider`/`videoId`. `exact()` (canonical JSON) does not. So `{heading:'A'}` vs `{heading:'A', subheading:''}` produces no prop changes but different exact keys, and the fallback reports a formatting/link change. Only fall back to that row when the difference is inside a rich-text or link value.
- **admin/src/pages/ComparePage.tsx:329** — With From = Current and To = the newest saved version, the screen offers "Restore this version" for a version that equals the current page *(consistency)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: The line above returns `null` for the mirror case (`toId === CURRENT && fromId === revisions[0].id`), with a comment saying such a restore "would change nothing". The swapped order skips that check. Add the same guard: `if (fromId === CURRENT) return toId === revisions[0]?.id ? null : toId;`.
- **admin/src/pages/EditorPage.tsx:42** — The "Restored the version from …" notice comes back after a browser reload or a back/forward to the editor *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: `location.state` is kept in the history entry, so every remount of that entry reads `notice` again, even long after the restore. Clear it once it has been read, for example `navigate(location.pathname, { replace: true, state: null })` in a mount effect.

## Reviewed files
- admin/src/App.tsx
- admin/src/components/HistoryPanel.css
- admin/src/components/HistoryPanel.tsx
- admin/src/components/RestoreConfirm.tsx
- admin/src/lib/diffBlocks.test.ts
- admin/src/lib/diffBlocks.ts
- admin/src/lib/revisions.ts
- admin/src/lib/revisionsApi.ts
- admin/src/pages/ComparePage.css
- admin/src/pages/ComparePage.tsx
- admin/src/pages/EditorPage.tsx
- docs/BACKLOG.md
- docs/DECISIONS.md
- docs/WORKLOG.md
- tickets/GOV-02.md
- tickets/STATUS.md
- node_modules/.vite/vitest/** and node_modules/.vitest-cache/** (174 files): skipped as generated cache, raised as a finding
