import { z } from 'zod';
import { assignableRoleSchema } from './membership.dto.js';

export const createInviteSchema = z.object({
  email: z.string().email(),
  role: assignableRoleSchema,
});

export type CreateInviteDto = z.infer<typeof createInviteSchema>;

export const acceptInviteSchema = z.object({
  // Only required for a brand-new account — an invite for an email that
  // already has one attaches a membership to it instead (see TeamService).
  name: z.string().min(1).optional(),
  password: z.string().min(8),
});

export type AcceptInviteDto = z.infer<typeof acceptInviteSchema>;
