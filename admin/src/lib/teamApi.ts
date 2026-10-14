import { apiDelete, apiGetPublic, apiPost, apiSend, apiGet } from './api';
import { getActiveMembership } from './activeSite'
import { getSession, type Session } from './auth';
import type { Role } from './roles';

// Team/invite management acts on the active site (the one in the address, D-070).

export type Member = {
  id: string;
  userId: string;
  siteId: string;
  role: Role;
  createdAt: string;
  user: { id: string; email: string; name: string };
};

export type Invite = {
  id: string;
  siteId: string;
  email: string;
  role: Role;
  invitedByUserId: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type CreatedInvite = Invite & { token: string; acceptUrl: string };

export type InvitePreview = { email: string; role: Role; siteName: string; existingAccount: boolean };

function requireSiteId(): string {
  const siteId = getActiveMembership()?.siteId;
  if (!siteId) throw new Error('Not authenticated');
  return siteId;
}

function requireToken(): string {
  const token = getSession()?.accessToken;
  if (!token) throw new Error('Not authenticated');
  return token;
}

export function listMembers(): Promise<Member[]> {
  return apiGet(`/sites/${requireSiteId()}/team/members`, requireToken());
}

export function updateMemberRole(membershipId: string, role: Role): Promise<Member> {
  return apiSend('PATCH', `/sites/${requireSiteId()}/team/members/${membershipId}`, { role }, requireToken());
}

export function removeMember(membershipId: string): Promise<void> {
  return apiDelete(`/sites/${requireSiteId()}/team/members/${membershipId}`, requireToken());
}

export function listInvites(): Promise<Invite[]> {
  return apiGet(`/sites/${requireSiteId()}/team/invites`, requireToken());
}

export function createInvite(email: string, role: Role): Promise<CreatedInvite> {
  return apiSend('POST', `/sites/${requireSiteId()}/team/invites`, { email, role }, requireToken());
}

export function revokeInvite(inviteId: string): Promise<void> {
  return apiDelete(`/sites/${requireSiteId()}/team/invites/${inviteId}`, requireToken());
}

// Unauthenticated — reached before any session exists.
export function previewInvite(token: string): Promise<InvitePreview> {
  return apiGetPublic(`/invites/${token}`);
}

export function acceptInvite(token: string, body: { name?: string; password: string }): Promise<Session> {
  return apiPost(`/invites/${token}/accept`, body);
}
