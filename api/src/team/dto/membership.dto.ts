import { z } from 'zod';

export const roleSchema = z.enum(['owner', 'administrator', 'editor', 'author', 'contributor']);

export const updateMembershipSchema = z.object({ role: roleSchema });

export type UpdateMembershipDto = z.infer<typeof updateMembershipSchema>;
