---
diff_hash: 93f8af47972bf702db2059c4913f90ed760b36f8e934974a565c772096d3b9a0
reviewed_at: 2026-10-12T10:28:20Z
---

## Summary

SEO-01 (D-056): a new `Content.seo` JSONB column (migration, default `{}`), Zod validation on write
(`api/src/content/seo.ts`: length limits, http(s)-only canonical, social image limited to this site's own
library via the now-exported `mediaValue`), fallbacks resolved in a pure function (`api/src/public/seo-view.ts`),
`PublicService.getPage`/`getPreview` returning `seo`, `web` turning it into title/description/canonical/Open
Graph/Twitter/robots metadata plus listing and 404 titles, and a "Search and sharing" section in admin's Page
settings with previews, counters and the media picker. The previous commit's review file is removed (staged
deletion).

Stacks: `api/` NestJS (nestjs.md), `admin/` React (react.md), `web/` Next.js (react.md). One git repository, so
one review. Cross-project contract check: the `seo` shape `api` returns (`PublicSeo`) matches `web/src/lib/publicApi.ts`
field for field; the `Seo` shape admin PATCHes matches `seoSchema` (unknown keys are stripped, the full picker URL is
normalised to the short `/uploads/...` form on write). `findLiveByPath` and `findPageByToken` use `include`, so the new
scalar column is loaded without a select change.

Security: canonical URL refuses `javascript:`, non-http(s), credentials and relative addresses; the social image cannot
point at another tenant's folder or an external host; an invalid `seo` aborts the whole update before any write; the
preview route keeps its own `noindex`. No issues found.

No Critical, High or Medium findings.

## Findings

### Critical (0)

### High (0)

### Medium (0)

### Low (2)
- **api/src/public/public.service.ts:519** — `seoOf` runs on every `getPreview` call too (one `sites.findById` plus, when a social image is set, one `media.findByFilenames`), but the preview route builds its own `noindex` metadata and never reads `seo`; and on `getPage` it re-reads the site's name, which `web` already fetched via `getSite`. Two extra queries per uncached render, small but avoidable. *(efficiency)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Either skip `seo` in `getPreview` (make it optional on the preview type) or accept the cost; ISR caching keeps the impact on live pages low, so this is a preference, not a defect.
- **admin/src/components/PageSeoSection.tsx:28** — Re-declares `API_URL` from `VITE_API_URL` (already private in `lib/api.ts`) and hardcodes the API's hard limits as magic numbers (`maxLength={120}`, `320`, `500`) while `lib/seo.ts` holds the matching advice constants. If either changes, the copies drift silently. *(maintainability)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Export a `fileUrl`/`API_URL` from `lib/api.ts` and add `TITLE_MAX`/`DESCRIPTION_MAX`/`CANONICAL_MAX` next to `TITLE_ADVICE` in `lib/seo.ts` (with a comment that they mirror `api/src/content/seo.ts`, since the repos can't share code).

## Reviewed files
- .code-reviews/brainx-review.md (deleted — previous commit's review)
- admin/src/components/PageSeoSection.css (skimmed — styling only)
- admin/src/components/PageSeoSection.tsx
- admin/src/components/PageSettingsPanel.tsx
- admin/src/lib/contentApi.ts
- admin/src/lib/seo.test.ts
- admin/src/lib/seo.ts
- api/prisma/migrations/20261012130000_add_content_seo/migration.sql
- api/prisma/schema.prisma
- api/src/content-types/field-values.ts
- api/src/content/content.service.spec.ts
- api/src/content/content.service.ts
- api/src/content/dto/content.dto.ts
- api/src/content/seo.spec.ts
- api/src/content/seo.ts
- api/src/public/public.service.spec.ts
- api/src/public/public.service.ts
- api/src/public/seo-view.spec.ts
- api/src/public/seo-view.ts
- docs/BACKLOG.md (docs)
- docs/DECISIONS.md (docs)
- docs/WORKLOG.md (docs)
- tickets/SEO-01.md (docs)
- tickets/STATUS.md (docs)
- web/.env.example
- web/src/app/layout.tsx
- web/src/app/sites/[subdomain]/[[...path]]/page.tsx
- web/src/app/sites/[subdomain]/not-found.tsx
- web/src/lib/publicApi.ts
- web/src/lib/seo.ts
