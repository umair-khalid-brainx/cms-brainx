---
diff_hash: 4116a4da8a8c72afdc17ccfd19d6ea57f9a165180a93625b66f044f7d70aa97c
reviewed_at: 2026-10-13T09:09:36Z
---

## Summary

DEP-02 custom domains (D-066). `api` (NestJS): `sites.host` becomes optional with a `domain_status` enum (migration
clears the seed's `*.yourcms.com` placeholders), `PUT`/`DELETE /sites/:siteId/domain` behind `site:manage`, a pure
`custom-domain.ts` that normalises input (scheme/path/port/trailing dot stripped, IDN to `xn--`) and refuses
non-domains, reserved TLDs and the platform's own root (`PUBLIC_ROOT_DOMAIN`, 503 in production when unset), and a
duplicate-domain 409 including the P2002 race. The seed now finds a site by its owner or subdomain instead of `host`.
GOV-07's unpushed migration is renamed to `20261012190000_…` so it sorts after week 4's; commit 924955b is on no
remote and the local `cms` database never applied it, so the rename cannot strand an applied migration.
`admin` (React): a Settings → Domains card showing the free address, the custom domain with a Pending badge, the DNS
record to add, and Remove. Cross-repo contract checked: `SiteDetails.customDomain`/`domainStatus` match the API's
`domainOf()` shape; `apiSend('PUT')` and `apiDelete` exist. `api` typecheck clean, `src/sites` 31 tests pass;
`admin` typecheck clean, `domains.test.ts` 3 tests pass.

## Findings

### Critical (0)

### High (0)

### Medium (1)
- **admin/src/components/CustomDomainCard.tsx:83** — The free address and the DNS record's "Points to" target are read once from the session at render (`hostOf(siteUrl('/'))`), and nothing re-renders the card when Site Address (the card directly above it) renames the subdomain. *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: `SiteAddressCard` keeps the new subdomain in its own state and writes it to the session, but `CustomDomainCard` neither subscribes to the session (`subscribeSession` is only used for `siteName` in `AdminLayout`) nor is re-rendered by its parent. After renaming `corrick` to `corrick-farm`, the card still shows `corrick.lvh.me` as Active and tells the owner to point their CNAME/ALIAS at the old host, which no longer resolves, until the page is reloaded. Fix: read the subdomain with `useSyncExternalStore(subscribeSession, currentSubdomain)` in the card (or lift it into `SettingsPage` and pass it down).

## Reviewed files
- admin/src/components/CustomDomainCard.tsx
- admin/src/lib/domains.test.ts
- admin/src/lib/domains.ts
- admin/src/lib/siteApi.ts
- admin/src/pages/SettingsPage.css
- admin/src/pages/SettingsPage.tsx
- api/.env.example
- api/prisma/migrations/20261012190000_add_review_and_scheduling/migration.sql (rename only, content unchanged)
- api/prisma/migrations/20261012200000_add_custom_domain/migration.sql
- api/prisma/schema.prisma
- api/prisma/seed.ts
- api/src/sites/custom-domain.spec.ts
- api/src/sites/custom-domain.ts
- api/src/sites/dto/site.dto.ts
- api/src/sites/site.repository.ts
- api/src/sites/sites.controller.ts
- api/src/sites/sites.service.spec.ts
- api/src/sites/sites.service.ts
- api/src/sites/subdomain-cache.spec.ts
- CLAUDE.md, docs/ARCHITECTURE.md, docs/BACKLOG.md, docs/DECISIONS.md, docs/WORKLOG.md, tickets/DEP-02.md, tickets/STATUS.md (docs; skimmed for consistency with the code)
- .code-reviews/brainx-review.md (previous review file deleted in the staged diff; not reviewed)
