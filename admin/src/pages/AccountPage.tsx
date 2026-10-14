import { useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router'
import { preferredSiteId } from '../lib/activeSite'
import { clearSession, getSession, subscribeSession, type Membership } from '../lib/auth'
import { ROLE_LABELS } from '../lib/roles'
import './AllSitesPage.css'

/**
 * The person, not a site (MSI-05): who they are and every site they belong to, with their role in each. It lives
 * outside `/sites/:siteId` because none of it changes with the site. Editing the name or password isn't built:
 * the API has no endpoint for it yet.
 */
export default function AccountPage() {
  const navigate = useNavigate()
  const snapshot = useSyncExternalStore(subscribeSession, () => JSON.stringify(getSession()))
  const session = JSON.parse(snapshot) as { user: { name: string; email: string }; memberships: Membership[] } | null
  const back = preferredSiteId()

  return (
    <div className="all-sites">
      <header className="all-sites-header">
        <h1>Your account</h1>
        <div className="all-sites-actions">
          {back && <Link to={`/sites/${back}/dashboard`}>&larr; Back to your site</Link>}
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

      <section className="all-sites-card all-sites-account">
        <dl>
          <div>
            <dt>Name</dt>
            <dd>{session?.user.name ?? '—'}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{session?.user.email ?? '—'}</dd>
          </div>
        </dl>
        <p className="all-sites-meta">Editing account details isn’t built yet.</p>
      </section>

      <h2 className="all-sites-subtitle">Your sites</h2>
      {session && session.memberships.length > 0 ? (
        <ul className="all-sites-list">
          {session.memberships.map((membership) => (
            <li key={membership.siteId} className="all-sites-card">
              <div>
                <h2>{membership.siteName}</h2>
                <p className="all-sites-meta">{ROLE_LABELS[membership.role]}</p>
              </div>
              <Link to={`/sites/${membership.siteId}/dashboard`} className="all-sites-open" aria-label={`Open ${membership.siteName}`}>
                Open
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="all-sites-empty">You don’t belong to any site yet.</p>
      )}
    </div>
  )
}
