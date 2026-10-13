import { z } from 'zod';

export const roleSchema = z.enum(['owner', 'administrator', 'editor', 'author', 'contributor', 'viewer']);

// A site has exactly one owner, set at creation, and it never changes hands
// through these routes — see TeamService.updateMemberRole/createInvite for
// the matching enforcement. 'owner' is deliberately not a selectable value
// here, so an attempt to grant or reassign it fails validation with a plain
// 400 rather than reaching the service.
export const assignableRoleSchema = z.enum(['administrator', 'editor', 'author', 'contributor', 'viewer']);

export const updateMembershipSchema = z.object({ role: assignableRoleSchema });

export type UpdateMembershipDto = z.infer<typeof updateMembershipSchema>;
