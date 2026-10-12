import { z } from 'zod';
import { TERM_KINDS } from '../term-rules.js';

// Shapes only: the name's own rules (length, tidying, slug) are checked in term-rules.ts so the
// message is written for the person typing it.
export const createTermSchema = z.object({
  kind: z.enum(TERM_KINDS, { message: 'A term is a category or a tag.' }),
  name: z.string().max(500, 'Keep the name to 60 characters or fewer.'),
});
export type CreateTermDto = z.infer<typeof createTermSchema>;

export const renameTermSchema = z.object({ name: z.string().max(500, 'Keep the name to 60 characters or fewer.') });
export type RenameTermDto = z.infer<typeof renameTermSchema>;
