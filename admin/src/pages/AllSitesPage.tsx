import { useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router'
import NewSiteDialog from '../components/NewSiteDialog'
import { clearSession, getSession, subscribeSession, type Membership } from '../lib/auth'
import { canCreateSite, ROLE_LABELS } from '../lib/roles'
import { siteUrl } from '../data/site'
import './AllSitesPage.css'

/** Every site the person belongs to, outside any one site (MSI-04): where to land with several, or with none. */
export default function AllSitesPage() {
  const navigate = useNavigate()
  const snapshot = useSyncExternalStore(subscribeSession, () => JSON.stringify(getSession()?.memberships ?? []))
  const memberships = JSON.parse(snapshot) as Membership[]
  const [creating, setCreating] = useState(false)

  return (
    <div className="all-sites">
      <header className="all-sites-header">
        <h1>Your sites</h1>
        <div className="all-sites-actions">
          {canCreateSite(memberships) && (
            <button type="button" className="all-sites-new" onClick={() => setCreating(true)}>
              + New site
            </button>
          )}
          <Link to="/account">Account</Link>
          <button
            type="button"
            className="all-sites-logout"
            onClick={() => {
              clearSession()
              navigate('/login', { replace: true })
            }}
          >
            Log Out
          </button>
        </div>
      </header>

      {memberships.length === 0 ? (
        <p className="all-sites-empty">You don’t belong to any site yet. Ask a site owner to invite you.</p>
      ) : (
        <ul className="all-sites-list">
          {memberships.map((membership) => (
            <li key={membership.siteId} className="all-sites-card">
              <div>
                <h2>{membership.siteName}</h2>
                <p className="all-sites-meta">
                  {siteUrl('/', membership.siteSubdomain).replace(/^https?:\/\//, '')} · {ROLE_LABELS[membership.role]}
                </p>
              </div>
              <Link to={`/sites/${membership.siteId}/dashboard`} className="all-sites-open" aria-label={`Open ${membership.siteName}`}>
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewSiteDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
