// Mirrors api/src/auth/permission.ts's 6 fixed roles — duplicated as a plain
// union, not shared code (no cross-repo imports). This file has zero actual
// permission logic: per admin/CLAUDE.md invariant 3, checks here are UI
// affordance only, the API enforces for real. Just role names for a <select>
// and a coarse "should I even show this control" gate.
export type Role = 'owner' | 'administrator' | 'editor' | 'author' | 'contributor' | 'viewer';

export const ROLES: Role[] = ['owner', 'administrator', 'editor', 'author', 'contributor', 'viewer'];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  administrator: 'Administrator',
  editor: 'Editor',
  author: 'Author',
  contributor: 'Contributor',
  viewer: 'Viewer',
};

/** Options shape the custom Select component (components/Select.tsx) wants. */
export const ROLE_OPTIONS = ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));

// A site has exactly one owner, set at creation — the API rejects any invite
// or role-change that names 'owner' (see api/src/team/dto), so it's left out
// of the choices offered here too, not just hidden after the fact.
export const ASSIGNABLE_ROLES: Role[] = ['administrator', 'editor', 'author', 'contributor', 'viewer'];
export const ASSIGNABLE_ROLE_OPTIONS = ASSIGNABLE_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));

export function canManageTeam(role: Role | undefined): boolean {
  return role === 'owner' || role === 'administrator';
}

// Mirrors which roles hold content:publish / content:delete in
// api/src/auth/permission.ts — used only to leave a status the user can't
// move to out of the pages list's dropdown. The API still refuses it.
export function canPublishContent(role: Role | undefined): boolean {
  return role === 'owner' || role === 'administrator' || role === 'editor' || role === 'author';
}

export function canArchiveContent(role: Role | undefined): boolean {
  return role === 'owner' || role === 'administrator' || role === 'editor';
}

/** Changing the site's subdomain — Owner and Administrator, matching the API's site:manage (D-031). */
export function canManageSite(role: Role | undefined): boolean {
  return role === 'owner' || role === 'administrator';
}

/** Contact form submissions — Owner, Administrator, Editor, matching the API's submissions:read (D-034). */
export function canReadSubmissions(role: Role | undefined): boolean {
  return role === 'owner' || role === 'administrator' || role === 'editor';
}

/** Approving or sending back submitted pages (GOV-07): Owner, Administrator, Editor, matching the API's content:review. */
export function canReviewContent(role: Role | undefined): boolean {
  return role === 'owner' || role === 'administrator' || role === 'editor';
}

/** Anything at all beyond looking: every role but Viewer holds content:write (GOV-07). */
export function canWriteContent(role: Role | undefined): boolean {
  return role !== undefined && role !== 'viewer';
}

/** One line on what each role can do, for the Team screen's role picker. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Everything, including the team and site settings',
  administrator: 'Everything, including the team and site settings',
  editor: 'Writes, publishes and reviews others’ work',
  author: 'Writes and publishes; can’t review others’ work',
  contributor: 'Writes drafts and submits them for review',
  viewer: 'Looks around; can’t change anything',
};
