import { z } from 'zod';

// Blocks are validated only loosely here (each must be an object with a
// `type` string) — the full per-type shape is cms-blocks/types.ts's contract,
// which `api` doesn't depend on (no cross-repo imports, CLAUDE.md). `admin`
// is what actually produces well-formed blocks; this is a sanity check, not
// re-validation of every block's fields.
const blockSchema = z.object({ type: z.string().min(1) }).catchall(z.unknown());

export const createContentSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  blocks: z.array(blockSchema).default([]),
});

export type CreateContentDto = z.infer<typeof createContentSchema>;

export const updateContentSchema = z
  .object({
    title: z.string().min(1).optional(),
    status: z.enum(['draft', 'published']).optional(),
    blocks: z.array(blockSchema).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

export type UpdateContentDto = z.infer<typeof updateContentSchema>;
