---
diff_hash: ac425e355a3f4057cd799fb33b1e23555998a14f9c4e71898a6b2edaa99aeab8
reviewed_at: 2026-10-13T09:57:12Z
---

## Summary

DEP-03 (realistic demo content), in `api` only (NestJS criteria; no root `package.json`) plus docs. The seed is split
into `prisma/seed-types.ts` (the shape), `prisma/seed-content/{corrick,kestrel}.ts` (each tenant's content as data)
and `seed.ts` (the machinery): team members with the dev password, a media library per site via `ensureMedia`,
`@media:` references resolved to library URLs with empty alt text filled from the library, nested pages found by
parent path, in-review and scheduled items with relative dates, SEO through the app's `parseSeo`, posts with excerpt,
featured image, author and terms, settings and menus written only where empty. 20 photos (Unsplash/Pexels) and a
Corrick SVG logo with `CREDITS.md`. Docs: D-068, a WORKLOG entry, a CLAUDE.md gotcha on `API_PUBLIC_URL`, DEP-03 DONE.

Checked: every block prop used in the content (hero `facts`, cta `note`, featureGrid items without `label`, teamGrid
`bio`, gallery `caption`, contactForm fields) exists in `cms-blocks/src/types.ts` (invariant 7); every rich-text HTML
string uses only tags the sanitiser allows; `status` values match `ContentStatus`; slug uniqueness is per site
(`@@unique([siteId, slug])`), so `alreadyThere`'s slug check matches the constraint; Corrick counts (9 pages, 7 posts,
13 files, 4 categories, 9 tags) match the content files. `api` `tsc --noEmit` is clean. The seed was not run in this
review. The Corrick owner's real email is unchanged from the previous seed (moved, not added), so it is not a finding.

## Findings

### Critical (0)

### High (0)

### Medium (0)

### Low (4)
- **api/prisma/seed.ts:54** — `termSlug` is a hand copy of `normaliseSlug` (`src/content/slug.ts`), which `taxonomy/term-rules.ts` uses to make a term's slug; the copy already differs (no `SLUG_MAX` truncation). The seed imports `parseSeo` from `src` for exactly this reason, so it could import `normaliseSlug` too. *(maintainability)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: If the app's slug rule changes, a seeded term's slug stops matching the one the admin derives from the same name, and the admin then creates a second term for it. No effect today: every seed term name is short and ASCII.
- **api/prisma/seed.ts:198** — Rich-text HTML in pages (and posts at line 242) is stored without `sanitizeBlocks`, while SEO goes through `parseSeo` "so the stored shape is the one a save makes". Invariant 5 says stored HTML is already safe. *(consistency)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Every HTML string in the seed today uses only allowlisted tags (`p`, `ol`, `ul`, `li`, `a href` relative), so sanitising would change nothing now. A later seed edit with a tag outside the allowlist would be stored and rendered as-is, unlike anything saved through the app.
- **docs/WORKLOG.md:14** — Says "23 photos" and (line 16) "Kestrel: … 12 files"; the diff has 20 photos (as D-068 and CREDITS.md say) and Kestrel's library is 8 photos plus the logo, 9 files. *(docs)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Stale counts from before three photos were dropped in review; the doc contradicts the code and D-068.
- **api/prisma/seed-media/CREDITS.md:3** — Cites D-064 (placeholder identities kept) as the decision for the photos; the decision for this content is D-068. *(docs)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Points a reader at the wrong decision entry.

## Reviewed files
- .code-reviews/brainx-review.md (deletion of the previous review; not reviewed)
- CLAUDE.md
- api/prisma/seed-content/corrick.ts
- api/prisma/seed-content/kestrel.ts
- api/prisma/seed-media/CREDITS.md
- api/prisma/seed-media/corrick/logo.svg
- api/prisma/seed-types.ts
- api/prisma/seed.ts
- docs/DECISIONS.md
- docs/WORKLOG.md
- tickets/DEP-03.md
- tickets/STATUS.md
- api/prisma/seed-media/corrick/*.jpg, api/prisma/seed-media/kestrel/*.jpg (20 binary photos; skipped)
