import { apiSend } from './api';
import { getSession, refreshSession } from './auth';

export type SiteSummary = { id: string; name: string; subdomain: string };

/**
 * Renames the current site's subdomain. The API enforces the rules (format,
 * reserved names, already taken, Owner/Administrator only — D-031); its error
 * message is what the caller shows. On success the stored session is updated
 * so every "View" link points at the new address straight away.
 */
export async function updateSubdomain(subdomain: string): Promise<SiteSummary> {
  const session = getSession();
  const membership = session?.memberships[0];
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
