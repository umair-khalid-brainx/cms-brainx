// Mirrors api/src/auth/permission.ts's 5 fixed roles — duplicated as a plain
// union, not shared code (no cross-repo imports). This file has zero actual
// permission logic: per admin/CLAUDE.md invariant 3, checks here are UI
// affordance only, the API enforces for real. Just role names for a <select>
// and a coarse "should I even show this control" gate.
export type Role = 'owner' | 'administrator' | 'editor' | 'author' | 'contributor';

export const ROLES: Role[] = ['owner', 'administrator', 'editor', 'author', 'contributor'];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  administrator: 'Administrator',
  editor: 'Editor',
  author: 'Author',
  contributor: 'Contributor',
};

/** Options shape the custom Select component (components/Select.tsx) wants. */
export const ROLE_OPTIONS = ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));

export function canManageTeam(role: Role | undefined): boolean {
  return role === 'owner' || role === 'administrator';
}
