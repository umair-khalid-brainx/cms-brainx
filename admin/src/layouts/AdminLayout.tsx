import { useEffect, useState, useSyncExternalStore } from 'react'
import { getActiveMembership } from '../lib/activeSite'
import { Outlet, useLocation } from 'react-router'
import { Link, NavLink, useNavigate } from '../lib/siteRouter'
import { clearSession, getSession, subscribeSession } from '../lib/auth'
import { useContentTypes } from '../lib/contentTypesContext'
import { canReviewContent } from '../lib/roles'
import { listReviewQueue } from '../lib/contentApi'
import { DASHBOARD_ITEM, visibleNavGroups, type NavIconName, type NavItem } from '../lib/navGroups'
import SiteSwitcher from '../components/SiteSwitcher'
import './AdminLayout.css'

const ICON_PATHS: Record<NavIconName, string> = {
  dashboard: 'M3 3h6v6H3V3Zm8 0h6v6h-6V3ZM3 11h6v6H3v-6Zm8 0h6v6h-6v-6Z',
  pages: 'M5 2h7l3 3v13H5V2Zm7 1.5V6h2.5L12 3.5ZM7 10h6v1.5H7V10Zm0 3h6v1.5H7V13Z',
  review: 'M4 2.5h8.5L16 6v4.1a5 5 0 0 0-1.5-.6V7h-3V4H5.5v12h3.6c.24.55.57 1.06.97 1.5H4v-15Zm10.5 9a3.5 3.5 0 0 1 2.82 5.57l1.56 1.56-1.06 1.06-1.56-1.56A3.5 3.5 0 1 1 14.5 11.5Zm0 1.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  media: 'M3 4h14v12H3V4Zm2 2v8l4-3.2 2.4 1.9L15 8.5V6H5Zm2 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z',
  submissions: 'M2 4h16v12H2V4Zm1.8 1.5L10 10.2l6.2-4.7H3.8ZM3.5 7.2v7.3h13V7.2L10 12.1 3.5 7.2Z',
  team: 'M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 16c0-2.9 2.46-5 5.5-5s5.5 2.1 5.5 5v.5h-11V16Zm12.7-4c2.3.35 3.8 1.9 3.8 4v.5h-3v-.5c0-1.5-.42-2.72-1.1-3.63.1-.1.2-.24.3-.37Z',
  types: 'M10 2 2 6l8 4 8-4-8-4Zm-6.4 7.2L2 10l8 4 8-4-1.6-.8L10 12.4 3.6 9.2Zm0 4L2 14l8 4 8-4-1.6-.8L10 16.4 3.6 13.2Z',
  menus: 'M3 5.25A.75.75 0 0 1 3.75 4.5h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 5.25Zm0 4.75a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 10Zm.75 4a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5Z',
  taxonomy: 'M2.5 3.75A1.25 1.25 0 0 1 3.75 2.5h5.1c.33 0 .65.13.88.37l7.4 7.4a1.25 1.25 0 0 1 0 1.77l-5.1 5.1a1.25 1.25 0 0 1-1.77 0l-7.4-7.4a1.25 1.25 0 0 1-.36-.88v-5.1Zm3.5 1.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z',
  redirects: 'M4 4.75A.75.75 0 0 1 4.75 4h6.5a4.75 4.75 0 0 1 0 9.5H6.56l1.72 1.72a.75.75 0 1 1-1.06 1.06l-3-3a.75.75 0 0 1 0-1.06l3-3a.75.75 0 0 1 1.06 1.06L6.56 12h4.69a3.25 3.25 0 0 0 0-6.5h-6.5A.75.75 0 0 1 4 4.75Z',
  settings: 'M8.5 2h3l.5 2.2c.5.17.96.4 1.4.68L15.5 4l2 2.1-1 2c.15.45.15.95 0 1.4l1 2-2 2.1-2.1-.88c-.44.28-.9.5-1.4.68L11.5 16h-3l-.5-2.2a6 6 0 0 1-1.4-.68L4.5 14l-2-2.1 1-2a3.3 3.3 0 0 1 0-1.4l-1-2 2-2.1 2.1.88c.44-.28.9-.5 1.4-.68L8.5 2ZM10 7.3A2.7 2.7 0 1 0 10 12.7 2.7 2.7 0 0 0 10 7.3Z',
}

function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

type Entry = { key: string; item: NavItem; count: number }

function AdminLayout() {
  const navigate = useNavigate()
  const session = getSession()
  // Subscribed, so a new site title saved in Settings shows here at once (GOV-04), not after a reload.
  const siteName = useSyncExternalStore(subscribeSession, () => getActiveMembership()?.siteName ?? 'No site')
  const userName = session?.user.name ?? 'Unknown user'
  // Affordance only (admin/CLAUDE.md invariant 3): the API enforces every one of these.
  const role = getActiveMembership()?.role
  const groups = visibleNavGroups(role)
  // How many pages wait for review, read again on every move between screens so an approval elsewhere
  // shows here without a reload. A failed read just shows no badge.
  const location = useLocation()
  const [waiting, setWaiting] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const reviews = canReviewContent(role)
  useEffect(() => {
    if (!reviews) return
    let cancelled = false
    listReviewQueue()
      .then((items) => {
        if (!cancelled) setWaiting(items.length)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [reviews, location.pathname])
  useEffect(() => {
    if (!drawerOpen) return
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setDrawerOpen(false)
      document.querySelector<HTMLElement>('.admin-menu-button')?.focus()
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [drawerOpen])
  // Each content type the site has gets its own place in the Content group, right under Pages, the moment it
  // exists (TYP-01).
  const { types } = useContentTypes()
  const entriesFor = (items: NavItem[]): Entry[] =>
    items.flatMap((item) => [
      { key: item.to, item, count: item.to === '/review' ? waiting : 0 },
      ...(item.to === '/pages'
        ? types.map((type) => ({
            key: `type-${type.id}`,
            item: { to: `/content/${type.prefix}`, label: type.name, icon: 'pages' as NavIconName },
            count: 0,
          }))
        : []),
    ])

  function handleLogout() {
    clearSession()
    navigate('/login', { replace: true })
  }

  function renderEntry({ key, item, count }: Entry) {
    return (
      <li key={key}>
        <NavLink to={item.to} className={({ isActive }) => 'admin-nav-item' + (isActive ? ' is-active' : '')}>
          <span className="admin-nav-icon">
            <NavIcon name={item.icon} />
          </span>
          {item.label}
          {count > 0 && (
            <span className="admin-nav-count">
              {count}
              <span className="admin-visually-hidden"> waiting</span>
            </span>
          )}
        </NavLink>
      </li>
    )
  }

  return (
    <div className={'admin-shell' + (drawerOpen ? ' is-drawer-open' : '')}>
      <aside className="admin-sidebar" id="admin-sidebar">
        <div className="admin-sidebar-logo">
          <span className="admin-logo-mark" aria-hidden="true" />
          <span className="admin-logo-text">Admin</span>
        </div>

        <nav className="admin-nav" aria-label="Main" onClick={(event) => (event.target as HTMLElement).closest('a') && setDrawerOpen(false)}>
          <ul className="admin-nav-list">{entriesFor([DASHBOARD_ITEM]).map(renderEntry)}</ul>
          {groups.map((group) => (
            <div key={group.id} className="admin-nav-group" role="group" aria-labelledby={`nav-${group.id}`}>
              <h2 className="admin-nav-heading" id={`nav-${group.id}`}>
                {group.label}
              </h2>
              <ul className="admin-nav-list">{entriesFor(group.items).map(renderEntry)}</ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="admin-scrim" onClick={() => setDrawerOpen(false)} aria-hidden="true" />

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-menu-button"
            aria-label="Menu"
            aria-controls="admin-sidebar"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M3 5.5h14M3 10h14M3 14.5h14" />
            </svg>
          </button>
          <SiteSwitcher siteName={siteName} />

          <div className="admin-user">
            <Link to="/account" className="admin-user-menu" title="Your account">
              <span className="admin-user-avatar">{initials(userName)}</span>
              <span className="admin-user-name">{userName}</span>
            </Link>
            <button type="button" className="admin-logout" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
