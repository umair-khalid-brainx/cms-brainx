import { Outlet, NavLink, useNavigate } from 'react-router'
import { clearSession, getSession } from '../lib/auth'
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
          {navItems.map((item) => (
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
