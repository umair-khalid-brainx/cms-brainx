---
diff_hash: 9dc46b7f30387e2500d3e632ed2cfc8a281b9e0fbaef2137277148481dacb7db
reviewed_at: 2026-10-14T14:13:28Z
---

## Summary

MSI-01 to MSI-06 / D-070: one account, several sites. One git repository holding separate projects, reviewed with
NestJS criteria for `api/` and React criteria for `admin/` (no root `package.json`, so detection is per folder). Scope:
all changes (everything staged, `git add -A`).

- **api:** `activeSiteMiddleware` (AsyncLocalStorage) holds the `X-Site-Id` header for each request.
  `UserRepository.findActiveMembership` resolves it: no header means the oldest membership, and a site the caller is
  not a member of is a 403. `PermissionsGuard` and every service's membership lookup now go through it, and
  `findByIdWithMemberships` orders by `createdAt`. `POST /sites` (`CreateSiteController`, JWT only) lets someone who owns
  a site create another: strict Zod DTO, a uniqueness pre-check plus P2002 mapped to 409, and a nested create of the
  site and its owner membership with `DEFAULT_THEME`. Specs use a `withActive` shim; new unit specs and
  `test/multi-site.e2e-spec.ts`.
- **admin:** routes moved under `/sites/:siteId` (`SiteScope` sets the active site and reloads the app when it changes),
  `siteRouter` wrappers prefix in-site links, `api.ts` sends `X-Site-Id`, and every `memberships[0]` became
  `getActiveMembership()`. Adds the site switcher, New site dialog, All sites page and Account page. Settings now
  holds only site settings.
- **docs/tickets:** D-070, B-42 to B-44, a worklog entry, MSI tickets and CLAUDE.md gotchas.

Cross-repo contract check: admin sends `X-Site-Id` on every authenticated call (GET, send, upload, delete). The API's
default CORS reflects requested headers, so the custom header passes preflight. `createSite` posts exactly
`{ name, subdomain }`, which the API's strict schema accepts, then re-reads `/auth/me`, whose memberships are now in
the same oldest-first order the API's "first membership" fallback uses. These match.

Security: the header is only a request. Every lookup re-checks membership, `:siteId` routes still use the param, and
the e2e suite covers a forged header, a non-site id, role-per-site and cross-site reads. No authz defect found.

Verified for this review: `api` typecheck clean, 813/813 unit tests pass; `multi-site` + `cross-tenant` e2e 502/502
pass. A throwaway e2e probe confirmed that a multipart `POST /media` with `X-Site-Id` lands in the named site, so the
AsyncLocalStorage context survives multer. `admin` typecheck clean, 234/234 tests pass. A throwaway happy-dom probe
reproduced the redirect loop below.

## Findings

### Critical (0)

### High (1)
- **admin/src/App.tsx:82** — The in-site catch-all `<Route path="*" element={<Navigate to="dashboard" replace />} />` resolves `dashboard` relative to the full splat URL (React Router 8 resolves the last match by `match.pathname`, not `pathnameBase`). So any unknown path inside a site redirects forever: `/sites/x/foo` → `/sites/x/foo/dashboard` → `/sites/x/foo/dashboard/dashboard` → … *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: Reproduced with a MemoryRouter probe using the same route shape: the location grew by `/dashboard` on every render until the guard stopped it. This happens for a mistyped URL, for `/sites/<id>/editor` with no slug, for `/sites/<id>/content` with no prefix, and for any unknown old-style path such as `/foo`, because `IntoPreferredSite keepPath` sends that to `/sites/<id>/foo`. Only the bare `/sites/<id>` works, because its splat is empty. The tab hangs in a replace-navigation loop. Fix: use an absolute target. One way is `siteRouter`'s `Navigate` with `to="/dashboard"`, which `scoped` prefixes because `SiteScope` has already set the active site. Another is to build `/sites/${siteId}/dashboard` from `useParams`. A route test for an unknown in-site path would keep it fixed.

### Medium (0)

### Low (2)
- **admin/src/lib/siteApi.ts:113** — `createSite` creates the site and then re-reads `/auth/me` in the same `try`. If the second call fails, the dialog says the create failed, but the site exists and the stored session doesn't list it. Retrying gives "That address is already taken", and `SiteScope` refuses the new site's id until the next login. *(correctness)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: This is rare because it needs a network or API failure between two calls, but the result misleads. Two ways to fix it: navigate to the new site even when the refresh fails and refresh again later, or append the returned site to the session's memberships before the refresh so the switcher and `SiteScope` know about it either way.
- **api/src/sites/site-theme.ts:90** — `DEFAULT_THEME` is a hand copy of admin's Oyster preset (`admin/src/lib/themeEdit.ts:52`). If either side changes, new sites start on a theme the editor no longer offers as "the first preset". The spec only pins `brand`. *(maintainability)*
  - status: open
  - dev_reasoning: N/A
  - ai_reasoning: The two projects can't import each other (D-012). If a single source isn't wanted, either put the preset palettes in the shared `cms-blocks` package, which both already depend on, or have admin's test assert that its first preset deep-equals a copy of the API's default. That way a change on one side fails a test instead of drifting silently.

## Reviewed files
- CLAUDE.md
- admin/src/App.tsx
- admin/src/components/CustomDomainCard.tsx
- admin/src/components/HistoryPanel.tsx
- admin/src/components/NewSiteDialog.css (skimmed)
- admin/src/components/NewSiteDialog.tsx
- admin/src/components/PageSettingsPanel.tsx
- admin/src/components/SiteIdentityCard.tsx
- admin/src/components/SiteSwitcher.css (skimmed)
- admin/src/components/SiteSwitcher.tsx
- admin/src/components/ThemeCard.tsx
- admin/src/data/site.ts
- admin/src/layouts/AdminLayout.css
- admin/src/layouts/AdminLayout.tsx
- admin/src/lib/RequireWrite.tsx
- admin/src/lib/SiteScope.tsx
- admin/src/lib/activeSite.test.ts
- admin/src/lib/activeSite.ts
- admin/src/lib/api.ts
- admin/src/lib/roles.ts
- admin/src/lib/siteApi.ts
- admin/src/lib/sitePath.test.ts
- admin/src/lib/sitePath.ts
- admin/src/lib/siteRouter.tsx
- admin/src/lib/teamApi.ts
- admin/src/pages/AcceptInvitePage.tsx
- admin/src/pages/AccountPage.tsx
- admin/src/pages/AllSitesPage.css (skimmed)
- admin/src/pages/AllSitesPage.tsx
- admin/src/pages/ComparePage.tsx
- admin/src/pages/CreatePagePage.tsx
- admin/src/pages/DashboardPage.tsx
- admin/src/pages/EditorPage.tsx
- admin/src/pages/LoginPage.tsx
- admin/src/pages/MediaPage.tsx
- admin/src/pages/MenusPage.tsx
- admin/src/pages/PagesListPage.tsx
- admin/src/pages/RedirectsPage.tsx
- admin/src/pages/ReviewPage.tsx
- admin/src/pages/SettingsPage.tsx
- admin/src/pages/SubmissionDetailPage.tsx
- admin/src/pages/SubmissionsPage.tsx
- admin/src/pages/TaxonomyPage.tsx
- admin/src/pages/TypeEntriesPage.tsx
- admin/src/pages/TypesPage.tsx
- api/src/app.module.ts
- api/src/auth/permissions.guard.ts
- api/src/common/active-site.ts
- api/src/content-types/content-types.service.spec.ts
- api/src/content-types/content-types.service.ts
- api/src/content/content.service.spec.ts
- api/src/content/content.service.ts
- api/src/content/workflow.service.spec.ts
- api/src/content/workflow.service.ts
- api/src/media/media.service.spec.ts
- api/src/media/media.service.ts
- api/src/menus/menus.service.spec.ts
- api/src/menus/menus.service.ts
- api/src/redirects/redirects.service.spec.ts
- api/src/redirects/redirects.service.ts
- api/src/revisions/revisions.service.spec.ts
- api/src/revisions/revisions.service.ts
- api/src/sites/dto/site.dto.ts
- api/src/sites/site-theme.ts
- api/src/sites/site.repository.ts
- api/src/sites/sites.controller.ts
- api/src/sites/sites.module.ts
- api/src/sites/sites.service.spec.ts
- api/src/sites/sites.service.ts
- api/src/sites/subdomain-cache.spec.ts
- api/src/submissions/submissions.service.ts
- api/src/taxonomy/terms.service.spec.ts
- api/src/taxonomy/terms.service.ts
- api/src/users/active-membership.spec.ts
- api/src/users/test-support.ts
- api/src/users/user.repository.ts
- api/test/cross-tenant.e2e-spec.ts
- api/test/multi-site.e2e-spec.ts
- docs/BACKLOG.md
- docs/DECISIONS.md (skimmed)
- docs/WORKLOG.md
- tickets/MSI-01.md … MSI-06.md (skimmed)
- tickets/STATUS.md
