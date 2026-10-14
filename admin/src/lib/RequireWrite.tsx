import type { ReactNode } from 'react'
import { getActiveMembership } from './activeSite'
import { Navigate } from './siteRouter'
import { canWriteContent } from './roles'

/**
 * A screen that only creates things: a Viewer who opens its address directly goes to the Pages list instead
 * (GOV-07). Affordance only (admin/CLAUDE.md invariant 3); the API refuses the create anyway.
 */
function RequireWrite({ children }: { children: ReactNode }) {
  if (!canWriteContent(getActiveMembership()?.role)) return <Navigate to="/pages" replace />
  return <>{children}</>
}

export default RequireWrite
