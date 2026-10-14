import { useMemo, useState, useSyncExternalStore } from 'react'
import { getActiveMembership } from '../lib/activeSite'
import { getSession, subscribeSession, type Membership } from '../lib/auth'
import { canCreateSite, ROLE_LABELS } from '../lib/roles'
import Menu, { type MenuItem } from './Menu'
import NewSiteDialog from './NewSiteDialog'

/**
 * The site menu in the top bar (MSI-04): every site the person belongs to, with their role in it, "All sites"
 * and — for someone who owns a site — "New site". Choosing a site goes to that site's dashboard; the address
 * carries the site from then on (MSI-03). Built on the shared Menu (ADM-03).
 */
export default function SiteSwitcher({ siteName }: { siteName: string }) {
  const [creating, setCreating] = useState(false)
  // A string snapshot, so the menu follows a new site or a rename without reading the session on every render.
  const snapshot = useSyncExternalStore(subscribeSession, () => JSON.stringify(getSession()?.memberships ?? []))
  const memberships = useMemo(() => JSON.parse(snapshot) as Membership[], [snapshot])
  const activeId = getActiveMembership()?.siteId

  const items: MenuItem[] = [
    ...memberships.map((membership) => ({
      id: membership.siteId,
      label: `${membership.siteName}${membership.siteId === activeId ? ' (current)' : ''} · ${ROLE_LABELS[membership.role]}`,
      href: `/sites/${membership.siteId}/dashboard`,
    })),
    { id: 'all', label: 'All sites', href: '/sites', separatorBefore: true },
    ...(canCreateSite(memberships) ? [{ id: 'new', label: 'New site', onSelect: () => setCreating(true) }] : []),
  ]

  return (
    <div className="site-switcher">
      <Menu label="Switch site" items={items} align="start" className="admin-site-switcher">
        {siteName}
        <svg viewBox="0 0 20 20" fill="none" width="14" height="14" aria-hidden="true">
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Menu>
      <NewSiteDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
