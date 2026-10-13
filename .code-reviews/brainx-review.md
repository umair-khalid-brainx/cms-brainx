---
diff_hash: aed65804f2615b5cd862489b82c160c1250af89144b98d7c468761f18693d807
reviewed_at: 2026-10-13T09:35:10Z
---

## Summary

GOV-08b / FND-03 / B-16, spanning `api` (NestJS), `admin` (React), `cms-blocks` and `web`. No root `package.json`;
each project was reviewed against its own stack (NestJS criteria for `api`, React criteria for `admin`/`cms-blocks`,
generic for `web/scripts`).

`api`: the seed builds Kestrel out as a second tenant (nested pages found by parent path, settings and menus written
only where empty, a library logo via the new `prisma/seed-media.ts`, which mirrors `MediaService.store`: row first,
file and thumbnail second, row removed if the write fails). `thumbnailFilenameFor` moves to `thumbnail.ts` so the seed
shares it. Invariant 1 is now a test (`test/tenant-scoping.spec.ts`, TypeScript-AST based, both exception lists empty);
the two breaches it found are fixed: `HealthRepository` holds the DB ping, and `MediaRepository.create(siteId, data)`
takes `siteId` first and spreads it last so the data can't override it. A route-by-route cross-tenant e2e suite with
a controller-metadata coverage check. `GET/PATCH /sites/:siteId[/settings]` now also return the stored `theme`.
`admin`: the editor fetches site details once, validates the theme (`readSiteTheme`) and draws the Puck canvas in it,
with a neutral fallback replacing the hard-coded Corrick theme. `cms-blocks`: Stats picks its column count from the
number of items (literal class names, no hex values). `web`: an `npm run check:isr` two-host ISR script.

Cross-repo contract checked: admin's `SiteDetails.theme: unknown` matches the API's `theme: site.themeJson`;
`updateSiteSettings` sends only `name/tagline/footerNote/logo`, so the new `theme` field is never posted back.
`CreatePagePage` still imports `config`, but only for block labels, so the fallback root doesn't change it.

Verified: `api` `tsc --noEmit` clean (covers `prisma/seed*.ts`); `test/tenant-scoping.spec.ts` + `src/media` specs
86/86 pass; `admin` `tsc -b` clean, `siteTheme.test.ts` 2/2 pass; `cms-blocks` `tsc --noEmit` clean. The DB-backed
`cross-tenant.e2e-spec.ts` and `check-isr-two-hosts.mjs` were not run in this review (read only).

## Findings

### Critical (0)

### High (0)

### Medium (0)

### Low (3)
- **api/prisma/seed.ts:463** — `parentId` holds the parent row (`{ id, typeId }`), not an id, and the error thrown when the parent is an entry says "no page at … seeded before it", which is wrong for that case. *(maintainability)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Behaviour is correct (an entry parent is refused, and `parentId?.id` is used for the write), but `parentId.typeId` reads oddly, and a seed author who points a page under an entry gets told the parent is missing. Rename to `parent` and split the message: "no page at X seeded before it" vs "X is an entry, not a page".
- **docs/DECISIONS.md:15** — D-067 says the seed's nested pages find their parent "by slug"; the code finds it by path (`page.path` minus its last segment, `siteId_path` lookup). *(consistency)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: The project rule is that the code wins and the doc is fixed in the same pass. The `SeedPage.nested` and `SeedMenuItem` comments in `seed.ts` already say "by path"; D-067 is new in this diff, so it can still be corrected in place to "by path".
- **web/scripts/check-isr-two-hosts.mjs:45** — The comment says "Twice" but the loop warms every page three times (`round < 3`). *(maintainability)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Harmless at runtime; a reader can't tell whether 3 is deliberate (e.g. to get past a STALE) or a leftover. Make the comment and the count agree.

## Reviewed files
- admin/src/lib/siteApi.ts
- admin/src/lib/siteTheme.test.ts
- admin/src/lib/siteTheme.ts
- admin/src/pages/EditorPage.tsx
- admin/src/puck/config.tsx
- admin/src/puck/entryFields.tsx
- api/prisma/seed-media.ts
- api/prisma/seed-media/kestrel/logo.svg
- api/prisma/seed.ts
- api/src/health/health.controller.ts
- api/src/health/health.module.ts
- api/src/health/health.repository.ts
- api/src/media/media.repository.ts
- api/src/media/media.service.spec.ts
- api/src/media/media.service.ts
- api/src/media/thumbnail.ts
- api/src/sites/sites.service.ts
- api/test/cross-tenant.e2e-spec.ts
- api/test/tenant-scoping.spec.ts
- cms-blocks/src/Stats.tsx
- web/CLAUDE.md
- web/package.json
- web/scripts/check-isr-two-hosts.mjs
- docs/BACKLOG.md, docs/DECISIONS.md, docs/WORKLOG.md, tickets/FND-03.md, tickets/GOV-08b.md, tickets/STATUS.md (docs; skimmed for consistency with the code)
- .code-reviews/brainx-review.md (previous review file deleted in the staged diff; not reviewed)
