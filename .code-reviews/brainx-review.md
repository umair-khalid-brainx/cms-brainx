---
diff_hash: 99a3b1aa8f0a3333f9879c6f40e06902bcdf36791977a0b8ad1e999258178b61
reviewed_at: 2026-10-14T15:16:18Z
---

## Summary

A fresh review. The `brainx-review.md` that was already here was the review of 36761cc, which has since been finalized
into the ledger and `records/`, so it does not describe this diff. React criteria (`admin/` only; no `api`, `web` or
`cms-blocks` change, so there is no cross-repo contract to check). Scope: all changes (everything staged, `git add -A`).

ADM-01 to ADM-07 / D-071, the admin redesign:

- **Shell and nav:** `--ui-*` tokens in `index.css`, light sidebar grouped Content / Site / Admin (`lib/navGroups.ts`),
  drawer under 860px. The nav's role rules match the old `requires*` flags one for one.
- **Dropdowns:** a shared `Menu` (menu button) and a rewritten `Select` (listbox), both portalled and placed by
  `useAnchoredPopup`; keyboard rules are pure functions in `lib/menuKeys.ts`. `Select` portals into an enclosing
  `<dialog>` so it isn't drawn under the modal's top layer. The site switcher is now built on `Menu`; its `/sites/...`
  links are left alone by `scoped()`.
- **Pages/Posts list:** client-side search and status filter (`lib/listFilter.ts`), a row actions `Menu`, and a
  read-only `ContentSidePanel` driven by `?view=<slug>`. `PageSummary` gains `updatedAt` (the list endpoint already
  returns full rows, so the field is there).
- **Page settings:** collapsible `SettingsSection` groups with an "Unsaved" marker fed by each field's `onDirty`; the
  parent picker moved from a native `<select>` to `Select`.
- **Everything else:** CSS retinted to the new tokens, with paired dark-mode rules. Docs: D-071, worklog, ADM tickets,
  STATUS totals (54+7=61 DONE, 62+7=69 tickets: correct).

Checked and fine: Escape handling between popups, the side panel and the settings `<dialog>` (the popup's capture
listener stops propagation and prevents default, and the panel checks `defaultPrevented`); outside-press and Tab
closing; stale placement on reopen (re-measured in a layout effect before paint); hooks before the early return in
`ParentField`; `SiteSwitcher` links; no `dangerouslySetInnerHTML`; external links carry `rel="noreferrer"`.

Verified for this review: `admin` typecheck clean, `oxlint` 0 errors (4 warnings, none new in kind), 260/260 tests pass.

Not a finding, but noted: `ui.css` (252 lines of `.ui-*` primitives) is loaded globally and not yet used by any
markup. D-071 records that as an accepted cost.

## Findings

### Critical (0)

### High (0)

### Medium (0)

### Low (4)
- **admin/src/components/PageSettingsPanel.tsx:593** — Moving the parent picker to `Select` dropped the live-page warning from its `aria-describedby`. The old native `<select>` appended `${id}-parent-live` when `changed && live`; the new one doesn't, so a screen reader user choosing a new parent for a live page no longer hears that old addresses will redirect. *(accessibility regression)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: The warning paragraph still renders with `id={`${id}-parent-live`}` (line 632), but nothing points at it now. Fix: add `${changed && live ? ` ${id}-parent-live` : ''}` back to the `aria-describedby` string passed to `Select`. Also, the filter input's `aria-controls={`${id}-parent`}` now points at the Select's trigger button rather than at a list, which is harmless but no longer accurate.
- **admin/src/pages/PagesListPage.tsx:194** — Opening the side panel pushes a history entry (`?view=<slug>`), but closing it *replaces* that entry with the bare list. History ends up as `[/pages, /pages]`, so after opening and closing a panel the browser's Back button seems to do nothing the first time. *(correctness / UX)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: `openDetails` calls `setSearchParams(...)` (push) and `closeDetails` calls it with `{ replace: true }`. Either open with `replace` too, so the panel never adds history, or close by going back one step when the panel was opened from inside the app. Opening with `replace` is the simpler option and still keeps the shareable `?view=` address.
- **admin/src/components/ContentSidePanel.tsx:80** — Below 720px the panel is a full-screen sheet that traps Tab, but it keeps `aria-modal="false"`. Screen readers can still browse the list behind it with their virtual cursor, which the visual design hides. *(accessibility)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: On narrow screens it behaves as a modal, so it should be announced as one. Set `aria-modal` from the same `matchMedia('(max-width: 720px)')` check the Tab trap already uses, or mark the list `inert` while the sheet is open. The worklog already lists the missing trap above 720px as not done; this is the narrow-screen case, where the trap exists but the semantics don't match it.
- **admin/src/pages/PagesListPage.css:178** — The status pill colours (published, scheduled, in review) are raw hex in both the light and dark rules. The note colour in `ContentSidePanel.css:150` repeats the scheduled palette as hex. D-071 says colours were remapped to the `--ui-*` palette, but these new rules weren't. *(maintainability)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: This doesn't affect behaviour, and invariant 2's hex ban covers blocks, not admin. But the same status colours now appear as literals in at least `PagesListPage.css`, `ContentSidePanel.css` and `WorkflowStrip.css`, so a palette change has to be made in several places. Add `--ui-status-*` tokens (light and dark) next to the others in `index.css` and use them in these rules.

## Reviewed files
- admin/src/components/ContentSidePanel.tsx
- admin/src/components/ContentSidePanel.css
- admin/src/components/Menu.tsx
- admin/src/components/Menu.css (skimmed)
- admin/src/components/PageSeoSection.tsx
- admin/src/components/PageSettingsPanel.tsx
- admin/src/components/PageSettingsPanel.css (skimmed)
- admin/src/components/PageTermsSection.tsx
- admin/src/components/Select.tsx
- admin/src/components/Select.css (skimmed)
- admin/src/components/SettingsSection.tsx
- admin/src/components/SettingsSection.css (skimmed)
- admin/src/components/SiteSwitcher.tsx
- admin/src/components/SiteSwitcher.css (deleted; checked nothing still imports it)
- admin/src/index.css
- admin/src/ui.css (skimmed)
- admin/src/layouts/AdminLayout.tsx
- admin/src/layouts/AdminLayout.css (skimmed: drawer hidden state)
- admin/src/lib/contentApi.ts
- admin/src/lib/listFilter.ts, listFilter.test.ts
- admin/src/lib/menuKeys.ts, menuKeys.test.ts
- admin/src/lib/navGroups.ts, navGroups.test.ts
- admin/src/lib/seoSummary.ts, seoSummary.test.ts
- admin/src/lib/settingsSections.ts, settingsSections.test.ts
- admin/src/lib/useAnchoredPopup.ts
- admin/src/main.tsx
- admin/src/pages/PagesListPage.tsx
- admin/src/pages/PagesListPage.css (skimmed: colours, dark mode)
- Restyle-only CSS, skimmed for colours, dark-mode pairing and global selectors: ContentTypeForm, FileTile, HistoryPanel, ImageUploadField, MediaDetailsForm, MediaLibraryModal, MenuEditor, NewSiteDialog, PublishChecksPanel, RichTextToolbar, SharePreview, ThemeCard, WorkflowStrip, AllSitesPage, ComparePage, CreatePagePage, DashboardPage, EditorPage, MediaPage, MenusPage, RedirectsPage, ReviewPage, SettingsPage, SubmissionsPage, TaxonomyPage, TeamPage, TypesPage, auth
- docs/DECISIONS.md, docs/WORKLOG.md, tickets/STATUS.md
- tickets/ADM-01.md … ADM-07.md (skimmed)
