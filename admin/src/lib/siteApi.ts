import { apiDelete, apiGet, apiSend } from './api';
import { getActiveMembership } from './activeSite'
import type { SiteTheme } from 'cms-blocks';
import { getSession, refreshSession, type Session } from './auth';

export type SiteSummary = { id: string; name: string; subdomain: string };

/** What Settings edits: the summary plus the public header and footer's tagline, note and logo (GOV-04). */
export type SiteDetails = SiteSummary & {
  tagline: string;
  footerNote: string;
  /** A picture in the site's media library (`/uploads/<site>/<file>`), or empty. */
  logo: string;
  /** The site's own domain (DEP-02), null until an owner adds one. Display only: nothing serves the site on it yet. */
  customDomain: string | null;
  /** Pending until someone confirms its DNS record; null without a domain. */
  domainStatus: 'pending' | 'verified' | null;
  /** The site's stored theme: the editor draws its canvas in it (B-16). Empty for a site that has none. */
  theme: unknown;
};

/** The API's hard limits (api/src/sites/site-settings.ts; the repos can't share code, so keep these in step). */
export const SITE_NAME_MAX = 100;
export const TAGLINE_MAX = 120;
export const FOOTER_NOTE_MAX = 400;

function requireMembership() {
  const session = getSession();
  const membership = getActiveMembership();
  if (!session || !membership) throw new Error('Not authenticated');
  return { session, membership };
}

export function getSiteDetails(): Promise<SiteDetails> {
  const { session, membership } = requireMembership();
  return apiGet(`/sites/${membership.siteId}`, session.accessToken);
}

/**
 * Saves the site's title, tagline, footer note and logo (GOV-04). The API checks every part and
 * names what is wrong; the stored session gets the new title, so the site picker and the page
 * heading show it straight away.
 */
export async function updateSiteSettings(
  changes: Partial<Pick<SiteDetails, 'name' | 'tagline' | 'footerNote' | 'logo'>>,
): Promise<SiteDetails> {
  const { session, membership } = requireMembership();
  const site = await apiSend<SiteDetails>('PATCH', `/sites/${membership.siteId}/settings`, changes, session.accessToken);
  refreshSession({
    user: session.user,
    memberships: session.memberships.map((m) => (m.siteId === site.id ? { ...m, siteName: site.name } : m)),
  });
  return site;
}

/**
 * Saves the site's look: the whole theme replaces the old one. The API refuses a theme with a wrong field or text
 * that can't be read, naming each problem (400); only owners and administrators may save it (403).
 */
export function updateSiteTheme(theme: SiteTheme): Promise<SiteDetails> {
  const { session, membership } = requireMembership();
  return apiSend('PATCH', `/sites/${membership.siteId}/theme`, theme, session.accessToken);
}

/**
 * Renames the current site's subdomain. The API enforces the rules (format,
 * reserved names, already taken, Owner/Administrator only — D-031); its error
 * message is what the caller shows. On success the stored session is updated
 * so every "View" link points at the new address straight away.
 */
export async function updateSubdomain(subdomain: string): Promise<SiteSummary> {
  const session = getSession();
  const membership = getActiveMembership();
  if (!session || !membership) throw new Error('Not authenticated');

  const site = await apiSend<SiteSummary>(
    'PATCH',
    `/sites/${membership.siteId}/subdomain`,
    { subdomain },
    session.accessToken,
  );

  refreshSession({
    user: session.user,
    memberships: session.memberships.map((m) =>
      m.siteId === site.id ? { ...m, siteSubdomain: site.subdomain } : m,
    ),
  });
  return site;
}

/** Adds or replaces the site's custom domain; the API cleans it up and refuses one that can't be used (DEP-02). */
export function setCustomDomain(domain: string): Promise<SiteDetails> {
  const { session, membership } = requireMembership();
  return apiSend('PUT', `/sites/${membership.siteId}/domain`, { domain }, session.accessToken);
}

export async function removeCustomDomain(): Promise<SiteDetails> {
  const { session, membership } = requireMembership();
  await apiDelete(`/sites/${membership.siteId}/domain`, session.accessToken);
  return getSiteDetails();
}

/**
 * Makes a new, empty site; the caller becomes its owner (MSI-02). Only a person who already owns a site may (403
 * otherwise), the API names a taken or reserved address (409 / 400). On success the stored memberships are
 * re-read, so the new site is in the switcher at once.
 */
export async function createSite(input: { name: string; subdomain: string }): Promise<SiteSummary> {
  const session = getSession();
  if (!session) throw new Error('Not authenticated');
  const site = await apiSend<SiteSummary>('POST', '/sites', input, session.accessToken);
  // Known to the session before anything else can fail: the site exists now, and the app refuses a site it doesn't list.
  refreshSession({ user: session.user, memberships: [...session.memberships, { siteId: site.id, siteName: site.name, siteSubdomain: site.subdomain, role: 'owner' }] });
  try {
    refreshSession(await apiGet<Pick<Session, 'user' | 'memberships'>>('/auth/me', session.accessToken));
  } catch {
    // The appended entry stands; the next page load re-reads the list.
  }
  return site;
}
