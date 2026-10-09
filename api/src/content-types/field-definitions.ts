import { z } from 'zod';

// The six kinds of field a content type can have (TYP-02). The palette is fixed
// on purpose (root invariant 8): a seventh kind is a scope change, not a setting.
// `FIELD_KINDS` is the one list; the value rules below are a record keyed by it,
// so adding a kind without its rule is a compile error.
export const FIELD_KINDS = ['text', 'richText', 'date', 'media', 'select', 'link'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export const MAX_FIELDS = 30;
export const MAX_OPTIONS = 30;

// Machine name, set once from the label and never changed: values are stored
// under it, and renaming a stored key would orphan every entry's data.
export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

const label = z
  .string()
  .trim()
  .min(1, 'Give every field a name')
  .max(60, 'Keep field names to 60 characters or fewer')
  .transform((value) => value.split('\u0000').join(''))
  .refine((value) => value.length > 0, 'Give every field a name');

const option = z.string().trim().min(1, 'An option can’t be empty').max(80, 'Keep options to 80 characters or fewer');

/** A field as stored on the type. */
export const fieldDefinitionSchema = z.object({
  key: z.string().regex(FIELD_KEY_PATTERN),
  label,
  kind: z.enum(FIELD_KINDS),
  required: z.boolean().default(false),
  options: z.array(option).max(MAX_OPTIONS).optional(),
});
export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;

/** A field as sent by the admin: an existing one carries its key, a new one doesn't. */
export const fieldInputSchema = z.object({
  key: z.string().regex(FIELD_KEY_PATTERN).optional(),
  label,
  kind: z.enum(FIELD_KINDS),
  required: z.boolean().default(false),
  options: z.array(option).max(MAX_OPTIONS).optional(),
});
export type FieldInput = z.infer<typeof fieldInputSchema>;

/** "Event date" becomes "event_date". Empty for a label with no letters or digits. */
export function keyFromLabel(text: string): string {
  const base = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_+|_+$)/g, '')
    .slice(0, 40)
    .replace(/_+$/, '');
  // A key starts with a letter, so "2026 dates" becomes "f_2026_dates".
  return /^[a-z]/.test(base) ? base : base ? `f_${base}`.slice(0, 40) : '';
}

export type FieldProblem = string;

/**
 * Turns what the admin sent into the stored list, or says what is wrong.
 * - Existing fields keep their key and kind (a kind change would reinterpret stored values).
 * - New fields get a key from their label, unique among the type's fields.
 * - Select fields need at least one option; other kinds carry none.
 * Removing a field from the list only hides it; entries keep its values.
 */
export function normaliseFields(
  incoming: FieldInput[],
  existing: readonly FieldDefinition[],
): { fields: FieldDefinition[]; problems: FieldProblem[] } {
  const problems: FieldProblem[] = [];
  const fields: FieldDefinition[] = [];
  const taken = new Set<string>();
  const known = new Map(existing.map((field) => [field.key, field]));

  if (incoming.length > MAX_FIELDS) problems.push(`A type can have up to ${MAX_FIELDS} fields.`);

  for (const input of incoming) {
    const previous = input.key ? known.get(input.key) : undefined;
    if (input.key && !previous) {
      problems.push(`"${input.label}" refers to a field that doesn't exist.`);
      continue;
    }
    if (previous && previous.kind !== input.kind) {
      problems.push(`"${input.label}" can't change from ${previous.kind} to ${input.kind}: its saved values would be misread.`);
      continue;
    }

    let key = previous?.key;
    if (!key) {
      const base = keyFromLabel(input.label);
      if (!base) {
        problems.push(`"${input.label}" needs some letters or numbers.`);
        continue;
      }
      key = base;
      for (let suffix = 2; taken.has(key) || known.has(key); suffix += 1) key = `${base.slice(0, 36)}_${suffix}`;
    }
    if (taken.has(key)) {
      problems.push(`Two fields use the same key "${key}".`);
      continue;
    }
    taken.add(key);

    let options: string[] | undefined;
    if (input.kind === 'select') {
      options = [...new Set(input.options ?? [])];
      if (options.length === 0) problems.push(`"${input.label}" needs at least one option.`);
    }
    fields.push({ key, label: input.label, kind: input.kind, required: input.required, ...(options && { options }) });
  }

  const labels = new Set<string>();
  for (const field of fields) {
    const lower = field.label.toLowerCase();
    if (labels.has(lower)) problems.push(`There are two fields called "${field.label}".`);
    labels.add(lower);
  }
  return { fields, problems };
}

/** Reads the stored list defensively: a malformed row yields no fields, never a crash. */
export function parseStoredFields(raw: unknown): FieldDefinition[] {
  const parsed = z.array(fieldDefinitionSchema).safeParse(raw);
  return parsed.success ? parsed.data : [];
}
