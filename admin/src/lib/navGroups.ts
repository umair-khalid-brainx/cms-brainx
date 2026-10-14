import type { Role } from './roles'
import { canManageSite, canManageTeam, canReadSubmissions, canReviewContent } from './roles'

// The admin menu's groups (ADM-02). Pure data plus one filter, so the grouping and the role rules can be tested
// without rendering. Role checks are UI affordance only (admin/CLAUDE.md invariant 3).
export type NavIconName =
  | 'dashboard' | 'pages' | 'review' | 'media' | 'submissions' | 'team' | 'types' | 'menus' | 'taxonomy' | 'redirects' | 'settings'

export type NavItem = {
  to: string
  label: string
  icon: NavIconName
  /** Present when the item is limited to some roles. */
  allowed?: (role: Role | undefined) => boolean
}

export type NavGroup = { id: 'content' | 'site' | 'admin'; label: string; items: NavItem[] }

export const DASHBOARD_ITEM: NavItem = { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' }

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'content',
    label: 'Content',
    items: [
      { to: '/pages', label: 'Pages', icon: 'pages' },
      { to: '/media', label: 'Media', icon: 'media' },
      { to: '/taxonomy', label: 'Categories & Tags', icon: 'taxonomy' },
      { to: '/review', label: 'Review', icon: 'review', allowed: canReviewContent },
    ],
  },
  {
    id: 'site',
    label: 'Site',
    items: [
      { to: '/menus', label: 'Menus', icon: 'menus', allowed: canManageSite },
      { to: '/redirects', label: 'Redirects', icon: 'redirects' },
      { to: '/submissions', label: 'Submissions', icon: 'submissions', allowed: canReadSubmissions },
      { to: '/settings', label: 'Site settings', icon: 'settings' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { to: '/team', label: 'Team', icon: 'team', allowed: canManageTeam },
      { to: '/types', label: 'Content types', icon: 'types', allowed: canManageSite },
    ],
  },
]

/** The groups a role sees; a group with nothing left is dropped. */
export function visibleNavGroups(role: Role | undefined): NavGroup[] {
  return NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => !item.allowed || item.allowed(role)) })).filter(
    (group) => group.items.length > 0,
  )
}
