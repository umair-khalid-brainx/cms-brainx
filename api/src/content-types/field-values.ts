import { z } from 'zod';
import { sanitizeRichText } from '../content/sanitize.js';
import { uploadFilename } from '../public/image-alt.js';
import type { FieldDefinition, FieldKind } from './field-definitions.js';

// What an entry may hold for each kind of field (TYP-02). Checked on every write,
// in the API, whatever the admin did. Empty values (blank, null) mean "not set"
// and are never stored; "required" is enforced when publishing, not on drafts.

const NO_NUL = (value: string) => value.split('\u0000').join('');

const textValue = z.string().transform(NO_NUL).pipe(z.string().trim().max(500, 'Keep text to 500 characters or fewer'));

// Sanitised on write like a page's rich text (root invariant 5).
const richTextValue = z
  .string()
  .max(50_000, 'That is too long')
  .transform((html) => sanitizeRichText(html));

const dateValue = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-09')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'That date does not exist');

const LINK_SCHEMES = /^(https?:\/\/\S+|mailto:\S+|\/[^/\\\s]\S*|\/|#\S+)$/i;

const linkValue = z
  .object({
    label: z.string().transform(NO_NUL).pipe(z.string().trim().max(100, 'Keep link text to 100 characters or fewer')),
    href: z.string().trim().max(500),
  })
  .refine((link) => link.href === '' || LINK_SCHEMES.test(link.href), {
    message: 'A link must start with https://, http://, mailto:, / or #',
    path: ['href'],
  })
  .refine((link) => link.href === '' || link.label !== '', { message: 'Add the text of the link', path: ['label'] });

/** A file from this site's own library, by its address. */
function mediaValue(siteId: string) {
  return z
    .string()
    .trim()
    .max(500)
    .refine((url) => uploadFilename(url, siteId) !== null, 'Choose a file from this site’s media library');
}

function selectValue(options: readonly string[] = []) {
  return z.string().refine((value) => options.includes(value), 'Choose one of the listed options');
}

type ValueRule = (field: FieldDefinition, siteId: string) => z.ZodType;

// Keyed by kind, so a new kind without a rule does not compile.
const RULES: Record<FieldKind, ValueRule> = {
  text: () => textValue,
  richText: () => richTextValue,
  date: () => dateValue,
  media: (_field, siteId) => mediaValue(siteId),
  select: (field) => selectValue(field.options),
  link: () => linkValue,
};

const isBlank = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '') ||
  (typeof value === 'object' &&
    value !== null &&
    'href' in value &&
    'label' in value &&
    String((value as { href: unknown }).href).trim() === '' &&
    String((value as { label: unknown }).label).trim() === '');

export type EntryDataResult =
  | { ok: true; values: Map<string, unknown>; cleared: Set<string> }
  | { ok: false; problems: string[] };

/**
 * Checks the values sent for an entry against its type's fields. Only keys of
 * current fields are read; anything else is ignored (a hidden field's saved
 * value is left exactly as it is). A blank value clears the field.
 */
export function parseEntryData(fields: readonly FieldDefinition[], raw: unknown, siteId: string): EntryDataResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, problems: ['The fields must be sent as an object.'] };
  }
  const input = raw as Record<string, unknown>;
  const values = new Map<string, unknown>();
  const cleared = new Set<string>();
  const problems: string[] = [];

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(input, field.key)) continue;
    const value = input[field.key];
    if (isBlank(value)) {
      cleared.add(field.key);
      continue;
    }
    const result = RULES[field.kind](field, siteId).safeParse(value);
    if (result.success) values.set(field.key, result.data);
    else problems.push(`${field.label}: ${result.error.issues[0]?.message ?? 'is not valid'}`);
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, values, cleared };
}

/** The saved values after applying an edit: hidden fields' values are kept. */
export function mergeEntryData(
  existing: unknown,
  result: { values: Map<string, unknown>; cleared: Set<string> },
): Record<string, unknown> {
  const merged: Record<string, unknown> =
    typeof existing === 'object' && existing !== null && !Array.isArray(existing) ? { ...(existing as Record<string, unknown>) } : {};
  for (const key of result.cleared) delete merged[key];
  for (const [key, value] of result.values) merged[key] = value;
  return merged;
}

/** Required fields with no value, for the publish check. */
export function missingRequired(fields: readonly FieldDefinition[], data: unknown): FieldDefinition[] {
  const saved = typeof data === 'object' && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  return fields.filter((field) => field.required && isBlank(saved[field.key]));
}
