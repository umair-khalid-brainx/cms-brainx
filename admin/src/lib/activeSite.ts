import { getSession, type Membership } from './auth'

// The site the admin is acting on (MSI-03). The URL is the source of truth (`/sites/:siteId/...`);
// `SiteScope` copies it here while it renders, so plain functions like the API client can read it without
// being handed a prop. The API gets it as `X-Site-Id` on every call and still checks membership itself.
let activeSiteId: string | null = null

const LAST_SITE_KEY = 'cms-admin.lastSite'

export function setActiveSiteId(siteId: string | null): void {
  activeSiteId = siteId
}

export function getActiveSiteId(): string | null {
  return activeSiteId
}

/** The membership for the active site; the first one when none is active yet (login, a stale link). */
export function getActiveMembership(): Membership | undefined {
  const memberships = getSession()?.memberships ?? []
  return memberships.find((membership) => membership.siteId === activeSiteId) ?? memberships[0]
}

/** Remembered per browser, so the next visit opens the site the person was last in. */
export function rememberSite(siteId: string): void {
  try {
    localStorage.setItem(LAST_SITE_KEY, siteId)
  } catch {
    // Best-effort, like the session itself.
  }
}

/** Where to land with no site in the address: the last site used if still a member of it, else the first. */
export function preferredSiteId(): string | undefined {
  const memberships = getSession()?.memberships ?? []
  let last: string | null = null
  try {
    last = localStorage.getItem(LAST_SITE_KEY)
  } catch {
    // ignore
  }
  return memberships.find((membership) => membership.siteId === last)?.siteId ?? memberships[0]?.siteId
}

/** `/sites/<id>` — what every in-site path starts with. */
export function siteBase(siteId: string | null = activeSiteId): string {
  return `/sites/${siteId ?? ''}`
}
