import { z } from 'zod';
import { fieldInputSchema, MAX_FIELDS } from '../field-definitions.js';

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .max(60, `Keep ${label} to 60 characters or fewer`)
    // Postgres refuses a NUL character in text, which would otherwise be a 500.
    .transform((value) => value.split('\u0000').join(''))
    .refine((value) => value.length > 0, `Enter ${label}`);

// The prefix's own rules (format, reserved words) are checked in the service so
// the message can be written for the person typing it (prefix.ts).
const prefix = z.string().trim();

export const createContentTypeSchema = z.object({
  name: name('a name'),
  singularName: name('a singular name'),
  prefix,
  fields: z.array(fieldInputSchema).max(MAX_FIELDS).optional(),
});

export type CreateContentTypeDto = z.infer<typeof createContentTypeSchema>;

export const updateContentTypeSchema = z
  .object({
    name: name('a name').optional(),
    singularName: name('a singular name').optional(),
    prefix: prefix.optional(),
    fields: z.array(fieldInputSchema).max(MAX_FIELDS).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' });

export type UpdateContentTypeDto = z.infer<typeof updateContentTypeSchema>;
