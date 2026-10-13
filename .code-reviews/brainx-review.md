---
diff_hash: 387006e4e70f91b2840aaa48e100112efca725652da7af48ab11120c10e3f664
reviewed_at: 2026-10-13T15:49:41Z
---

## Summary

B-40 / D-069: clients edit their own site theme. Two repos' worth of code in one git repository, reviewed with
NestJS criteria for `api/` and React criteria for `admin/` (no root `package.json`, so per-folder detection).

- **api:** `PATCH /sites/:siteId/theme` (`site:manage`), strict Zod schema in `site-theme.ts` (fixed choices,
  `#rrggbb` colours, no extra keys), a WCAG 4.5:1 check on four text/background pairs, `SitesService.updateTheme`
  (404 first, validate, contrast, write whole, revalidate the site), `SiteRepository.updateTheme`. Unit tests for
  schema, contrast and service.
- **admin:** `ThemeCard` on Settings (presets, 4 radio groups, 8 colour fields with picker + hex, live preview in a
  `SiteThemeRoot`, Discard, inline readability warning, owner/admin gating as affordance), `ThemePreview`,
  `lib/themeEdit.ts` mirroring the API's contrast rule, `updateSiteTheme` in `siteApi.ts`, grain/grid textures in
  `index.css`.
- **docs:** D-069, B-40/B-41, worklog entry.

Cross-repo contract check: admin sends exactly the `SiteTheme` shape the API's strict schema accepts, and reads the
400 body's `message` array the service throws; the preset hexes are uppercase and the API regex is case-insensitive.
Consistent. Validation is server-side and strict, siteId comes from the route behind the permission guard, the
repository write is the existing site-row pattern. No security or correctness defect found in the save path.

Re-review (2026-10-13T15:49:41Z): the chip, no-theme state and dead `readTheme` findings are fixed; the docs finding
is fixed except for one stale `readTheme` mention left by the removal.

Verified on re-review: `api` `src/sites` tests 42/42 pass (one fewer: the `readTheme` test went with it), `admin`
`themeEdit.test.ts` 6/6 pass, both typecheck clean.

## Findings

### Critical (0)

### High (0)

### Medium (1)
- **admin/src/components/ThemeCard.css:448** — The preview's "New" chip draws `--site-ink` text on `--site-accent`, a pair the contrast check never tests and no real block uses. With the shipped Rigging preset (one of the two demo looks) that is #E6EAEF on #F2C230, 1.39:1: the preview shows unreadable text the public site never has, right next to a check that says the theme is readable. *(correctness)*
  - status: fixed
  - dev_reasoning: N/A
  - ai_reasoning: `.tp-chip` no longer has an accent background: accent is now a 1.5px inset ring (a marker, as blocks use it) and the chip is transparent, so its `--site-ink` text sits on the card's `--site-surface`, the ink/surface pair the check already enforces.

### Low (3)
- **admin/src/components/ThemeCard.tsx:63** — A site with no whole stored theme is shown with Oyster as its saved theme, but the public site wears its neutral fallback; and because `saved === draft`, Save stays disabled, so the client cannot save the look the card says they already have until they change something. *(correctness)*
  - status: fixed
  - dev_reasoning: N/A
  - ai_reasoning: `saved` now stays `null` when `readSiteTheme` returns null, only `draft` is seeded from the first preset, `changed` is `saved === null || !sameTheme(...)` so Save is enabled at once, and the card says "This site has no theme yet, so it shows a plain default" (ThemeCard.tsx:224).
- **api/src/sites/site-theme.ts:90** — `readTheme` is exported and tested but nothing in `api` calls it; `getDetails` still returns raw `themeJson`. Dead code that suggests a read-side check exists when it doesn't. *(maintainability)*
  - status: fixed
  - dev_reasoning: N/A
  - ai_reasoning: `readTheme` and its test were removed; no reference to it remains in `api/src` or `admin/src`.
- **docs/WORKLOG.md:24** — "no theme history or undo (see B-40)" points at the shipped item; the gaps list is B-41. Separately, D-069 and the service comment say "a saved theme can never be unreadable", but accent is used as text on paper (Stats figures, FeatureGrid numbers, PricingTable marks) and that pair is unchecked: 2.1–2.9:1 in three of the four presets. *(maintainability)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Mostly fixed: the worklog now points at B-41, D-069 and the `updateTheme` comment say accent is not checked, and B-41 item (6) records the accent gap. Still needed: WORKLOG.md:13 lists `readTheme` among what `site-theme.ts` contains, but the fix for the dead-code finding removed it, so the worklog now describes code that does not exist (project rule: the code wins, fix the doc). Drop "`readTheme`" from that line. (Optional: `site-theme.ts`'s `READABLE_PAIRS` comment still says "a saved theme can never be unreadable"; now that B-41 records the gap, "can't have unreadable body text" would match D-069.)

## Reviewed files
- admin/src/components/ThemeCard.css
- admin/src/components/ThemeCard.tsx
- admin/src/components/ThemePreview.tsx
- admin/src/index.css
- admin/src/lib/siteApi.ts
- admin/src/lib/themeEdit.test.ts
- admin/src/lib/themeEdit.ts
- admin/src/pages/SettingsPage.css
- admin/src/pages/SettingsPage.tsx
- api/src/sites/site-theme.spec.ts
- api/src/sites/site-theme.ts
- api/src/sites/site.repository.ts
- api/src/sites/sites.controller.ts
- api/src/sites/sites.service.spec.ts
- api/src/sites/sites.service.ts
- docs/BACKLOG.md
- docs/DECISIONS.md
- docs/WORKLOG.md
