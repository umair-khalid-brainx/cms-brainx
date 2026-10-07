import { Outlet, NavLink, useNavigate } from 'react-router'
import { clearSession, getSession } from '../lib/auth'
import { canManageTeam, canReadSubmissions } from '../lib/roles'
import './AdminLayout.css'

const navItems = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M3 3h6v6H3V3Zm8 0h6v6h-6V3ZM3 11h6v6H3v-6Zm8 0h6v6h-6v-6Z" />
      </svg>
    ),
  },
  {
    to: '/pages',
    label: 'Pages',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 2h7l3 3v13H5V2Zm7 1.5V6h2.5L12 3.5ZM7 10h6v1.5H7V10Zm0 3h6v1.5H7V13Z" />
      </svg>
    ),
  },
  {
    to: '/media',
    label: 'Media',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M3 4h14v12H3V4Zm2 2v8l4-3.2 2.4 1.9L15 8.5V6H5Zm2 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
      </svg>
    ),
  },
  {
    to: '/submissions',
    label: 'Submissions',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 4h16v12H2V4Zm1.8 1.5L10 10.2l6.2-4.7H3.8ZM3.5 7.2v7.3h13V7.2L10 12.1 3.5 7.2Z" />
      </svg>
    ),
    requiresSubmissionsRead: true,
  },
  {
    to: '/team',
    label: 'Team',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-1.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 16c0-2.9 2.46-5 5.5-5s5.5 2.1 5.5 5v.5h-11V16Zm12.7-4c2.3.35 3.8 1.9 3.8 4v.5h-3v-.5c0-1.5-.42-2.72-1.1-3.63.1-.1.2-.24.3-.37Z" />
      </svg>
    ),
    requiresTeamManage: true,
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M8.5 2h3l.5 2.2c.5.17.96.4 1.4.68L15.5 4l2 2.1-1 2c.15.45.15.95 0 1.4l1 2-2 2.1-2.1-.88c-.44.28-.9.5-1.4.68L11.5 16h-3l-.5-2.2a6 6 0 0 1-1.4-.68L4.5 14l-2-2.1 1-2a3.3 3.3 0 0 1 0-1.4l-1-2 2-2.1 2.1.88c.44-.28.9-.5 1.4-.68L8.5 2ZM10 7.3A2.7 2.7 0 1 0 10 12.7 2.7 2.7 0 0 0 10 7.3Z" />
      </svg>
    ),
  },
]

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function AdminLayout() {
  const navigate = useNavigate()
  const session = getSession()
  const siteName = session?.memberships[0]?.siteName ?? 'No site'
  const userName = session?.user.name ?? 'Unknown user'
  // Affordance only (admin/CLAUDE.md invariant 3) — hiding the nav item for
  // a role that can't manage the team is UX, not the real gate; the API
  // enforces members:manage for real on every team/invite route.
  const role = session?.memberships[0]?.role
  const visibleNavItems = navItems.filter(
    (item) =>
      (!item.requiresTeamManage || canManageTeam(role)) &&
      (!item.requiresSubmissionsRead || canReadSubmissions(role)),
  )

  function handleLogout() {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-logo">
          <span className="admin-logo-mark">CMS</span>
          <span className="admin-logo-text">Admin</span>
        </div>

        <nav className="admin-nav">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 'admin-nav-item' + (isActive ? ' is-active' : '')}
            >
              <span className="admin-nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button type="button" className="admin-site-switcher">
            {siteName}
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>

          <div className="admin-user">
            <span className="admin-user-menu">
              <span className="admin-user-avatar">{initials(userName)}</span>
              {userName}
            </span>
            <button type="button" className="admin-logout" onClick={handleLogout}>
              Log Out
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
