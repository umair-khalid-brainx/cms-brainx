import { z } from 'zod';
import { choiceSchema } from '../../chrome/chrome-rules.js';

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
  // The page this one sits under (CNT-05). Pages only.
  parentId: z.string().min(1).optional(),
  blocks: z.array(blockSchema).default([]),
  // The key of a starter layout (`landing`): the new page starts with its blocks (TYP-04). Not with `blocks`.
  layout: z.string().min(1).max(64).optional(),
  // Entries of a type that uses them (TAX-01). Categories by id; tags by name, a new name makes a new tag.
  categoryIds: z.array(z.string().min(1)).max(200).optional(),
  tags: z.array(z.string().max(500)).max(100).optional(),
});

export type CreateContentDto = z.infer<typeof createContentSchema>;

export const updateContentSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    // A new slug (CNT-04): an explicit change, normalised and checked by the service.
    // The title never changes it.
    slug: z.string().max(200).optional(),
    // Moves the page under another page, or to the top level with null (CNT-05). Pages only.
    parentId: z.string().min(1).nullable().optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    // Search and social-sharing settings, saved whole (SEO-01). Checked field by field in content/seo.ts.
    seo: z.record(z.string(), z.unknown()).optional(),
    // Which header and footer the page shows: `default`, `hidden` or a saved one's id; a part left out is unchanged.
    chrome: choiceSchema.optional(),
    blocks: z.array(blockSchema).optional(),
    // Values of a content type's custom fields, by field key (TYP-02). Entries only.
    data: z.record(z.string(), z.unknown()).optional(),
    // The entry's categories and tags, each saved whole (TAX-01). Left out means unchanged.
    categoryIds: z.array(z.string().min(1)).max(200).optional(),
    tags: z.array(z.string().max(500)).max(100).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

export type UpdateContentDto = z.infer<typeof updateContentSchema>;
