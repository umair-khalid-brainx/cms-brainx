import type { Role } from '../generated/prisma/client.js';

// The 6 roles are fixed, code-defined presets (GOV-06) — not a runtime
// permission-builder. An owner assigns one of these to each member; nobody
// redefines what "Editor" means. See DECISIONS.md D-023.
export type PermissionKey =
  | 'content:read'
  | 'content:write'
  | 'content:publish'
  // Approving or sending back someone's submitted page (GOV-07). Author can publish its own work but can't
  // review anyone else's, as in WordPress (D-064).
  | 'content:review'
  | 'content:delete'
  | 'members:manage'
  // Site-level settings, currently just the subdomain (D-031).
  | 'site:manage'
  // Contact form submissions hold visitors' personal details (BLK-06, D-034).
  | 'submissions:read';

// Author/Contributor differ from Editor only by permission level here, not by
// content ownership — this app has no concept of "who wrote this page" on
// Content (no authorId), so unlike real WordPress, an Author or Contributor
// can act on any page, not just "their own." Deliberate simplification,
// recorded in D-023.
export const ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  owner: ['content:read', 'content:write', 'content:publish', 'content:review', 'content:delete', 'members:manage', 'site:manage', 'submissions:read'],
  administrator: ['content:read', 'content:write', 'content:publish', 'content:review', 'content:delete', 'members:manage', 'site:manage', 'submissions:read'],
  editor: ['content:read', 'content:write', 'content:publish', 'content:review', 'content:delete', 'submissions:read'],
  author: ['content:read', 'content:write', 'content:publish'],
  // Writes drafts and submits them for review (GOV-07); can't change a live page.
  contributor: ['content:read', 'content:write'],
  // Looks, changes nothing (GOV-07, req. 7). Every write route needs more than content:read.
  viewer: ['content:read'],
};

export function hasPermission(role: Role, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
