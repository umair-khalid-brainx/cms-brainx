import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { getActiveMembership } from '../lib/activeSite'
import { getSession, subscribeSession, type Membership } from '../lib/auth'
import { canCreateSite, ROLE_LABELS } from '../lib/roles'
import NewSiteDialog from './NewSiteDialog'
import './SiteSwitcher.css'

/**
 * The site menu in the top bar (MSI-04): every site the person belongs to, with their role in it, "All sites"
 * and — for someone who owns a site — "New site". Choosing a site goes to that site's dashboard; the address
 * carries the site from then on (MSI-03).
 */
export default function SiteSwitcher({ siteName }: { siteName: string }) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  // A string snapshot, so the menu follows a new site or a rename without reading the session on every render.
  const snapshot = useSyncExternalStore(subscribeSession, () => JSON.stringify(getSession()?.memberships ?? []))
  const memberships = useMemo(() => JSON.parse(snapshot) as Membership[], [snapshot])
  const activeId = getActiveMembership()?.siteId

  useEffect(() => {
    if (!open) return
    const away = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div className="site-switcher" ref={root}>
      <button type="button" className="admin-site-switcher" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {siteName}
        <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" aria-hidden="true">
          <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      {open && (
        <div className="site-switcher-menu" role="menu">
          <ul className="site-switcher-list">
            {memberships.map((membership) => (
              <li key={membership.siteId}>
                <Link
                  to={`/sites/${membership.siteId}/dashboard`}
                  role="menuitem"
                  className={'site-switcher-item' + (membership.siteId === activeId ? ' is-active' : '')}
                  aria-current={membership.siteId === activeId ? 'true' : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className="site-switcher-name">{membership.siteName}</span>
                  <span className="site-switcher-role">{ROLE_LABELS[membership.role]}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="site-switcher-footer">
            <Link to="/sites" role="menuitem" onClick={() => setOpen(false)}>
              All sites
            </Link>
            {canCreateSite(memberships) && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  setCreating(true)
                }}
              >
                + New site
              </button>
            )}
          </div>
        </div>
      )}
      <NewSiteDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
