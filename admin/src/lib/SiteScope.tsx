import { Navigate, Outlet, useParams } from 'react-router'
import { getActiveSiteId, rememberSite, setActiveSiteId } from './activeSite'
import { getSession } from './auth'

/**
 * Everything under `/sites/:siteId`. The site in the address is the active site: it is set before any child
 * renders (so their first request already carries `X-Site-Id`) and remembered for the next visit. A site the
 * person isn't a member of goes to the all-sites page; the API would refuse it anyway (MSI-01).
 *
 * Moving from one site to another reloads the app instead of re-rendering. A request chain still in flight from the old
 * site (the editor's save, then check, then publish) reads the active site on each call: with a client-side switch its
 * later calls would carry the new site's id and could write the old site's page over the new one's. A reload ends every
 * such chain. The active site is also left as it was on the all-sites and account pages, so a straggler there still
 * names its own site rather than falling back to the oldest.
 */
export default function SiteScope() {
  const { siteId } = useParams()
  const isMember = !!siteId && !!getSession()?.memberships.some((membership) => membership.siteId === siteId)
  if (!isMember) return <Navigate to="/sites" replace />
  const previous = getActiveSiteId()
  if (previous && previous !== siteId) {
    window.location.reload()
    return null
  }
  setActiveSiteId(siteId)
  rememberSite(siteId)
  return <Outlet />
}
