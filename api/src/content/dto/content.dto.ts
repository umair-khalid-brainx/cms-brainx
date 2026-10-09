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
  // The address prefix of a content type (`events`): makes this an entry of that type (TYP-01).
  type: z.string().min(1).optional(),
  blocks: z.array(blockSchema).default([]),
  // The key of a starter layout (`landing`): the new page starts with its blocks (TYP-04). Not with `blocks`.
  layout: z.string().min(1).max(64).optional(),
});

export type CreateContentDto = z.infer<typeof createContentSchema>;

export const updateContentSchema = z
  .object({
    title: z.string().min(1).optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    blocks: z.array(blockSchema).optional(),
    // Values of a content type's custom fields, by field key (TYP-02). Entries only.
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

export type UpdateContentDto = z.infer<typeof updateContentSchema>;
