import { z } from 'zod';

// A blank box means "none": stored as null, so the library and the live site's
// fallback only ever see real text.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it to ${max} characters or fewer`)
    .transform((value) => (value === '' ? null : value))
    .optional();

export const updateMediaSchema = z
  .object({
    alt: optionalText(500),
    title: optionalText(200),
    description: optionalText(2000),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

export type UpdateMediaDto = z.infer<typeof updateMediaSchema>;
