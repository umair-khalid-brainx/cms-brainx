import type { Role } from '../generated/prisma/client.js';

// The 5 roles are fixed, code-defined presets (GOV-06) — not a runtime
// permission-builder. An owner assigns one of these to each member; nobody
// redefines what "Editor" means. See DECISIONS.md D-023.
export type PermissionKey =
  | 'content:read'
  | 'content:write'
  | 'content:publish'
  | 'content:delete'
  | 'members:manage'
  // Site-level settings, currently just the subdomain (D-031).
  | 'site:manage';

// Author/Contributor differ from Editor only by permission level here, not by
// content ownership — this app has no concept of "who wrote this page" on
// Content (no authorId), so unlike real WordPress, an Author or Contributor
// can act on any page, not just "their own." Deliberate simplification,
// recorded in D-023.
export const ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  owner: ['content:read', 'content:write', 'content:publish', 'content:delete', 'members:manage', 'site:manage'],
  administrator: ['content:read', 'content:write', 'content:publish', 'content:delete', 'members:manage', 'site:manage'],
  editor: ['content:read', 'content:write', 'content:publish', 'content:delete'],
  author: ['content:read', 'content:write', 'content:publish'],
  contributor: ['content:read', 'content:write'],
};

export function hasPermission(role: Role, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
