import { z } from 'zod';
import { sanitizeRichText } from '../content/sanitize.js';
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
  .transform((html) => sanitizeRichText(NO_NUL(html)));

const dateValue = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-09')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'That date does not exist');

const LINK_SCHEMES = /^(https?:\/\/\S+|mailto:\S+|\/[^/\\\s]\S*|\/|#\S+)$/i;
// Control, zero-width and line-separator characters have no place in an address.
// eslint-disable-next-line no-control-regex
const HIDDEN_CHARACTERS = /[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202f\u2060\ufeff]/;

const linkValue = z
  .object({
    label: z.string().transform(NO_NUL).pipe(z.string().trim().max(100, 'Keep link text to 100 characters or fewer')),
    href: z.string().trim().max(500),
  })
  .refine((link) => !HIDDEN_CHARACTERS.test(link.href), { message: 'That link has characters that can’t be used', path: ['href'] })
  .refine((link) => link.href === '' || LINK_SCHEMES.test(link.href), {
    message: 'A link must start with https://, http://, mailto:, / or #',
    path: ['href'],
  })
  .refine((link) => link.href === '' || link.label !== '', { message: 'Add the text of the link', path: ['label'] });

/**
 * A file from this site's own library. Only `/uploads/<this site>/<file>` is accepted, with
 * or without the API's address in front, and what is stored is always the short form: the
 * address in front is dropped, so nothing but our own path can ever be saved (a `javascript:`
 * address, another host, another site's folder, a query string and any other path all fail).
 * `web` adds the API's address when it shows the file.
 */
export function mediaValue(siteId: string) {
  const pattern = new RegExp(`^(?:https?://[^\\s/?#]+)?(/uploads/${siteId.replace(/[^A-Za-z0-9]/g, '')}/[A-Za-z0-9-]+\\.[A-Za-z0-9]+)$`);
  return z
    .string()
    .trim()
    .max(500)
    .refine((url) => pattern.test(url), 'Choose a file from this site’s media library')
    .transform((url) => url.replace(pattern, '$1'));
}

/**
 * Empty, or a file from this site's own library (see `mediaValue`), with the library rule's
 * message otherwise. For settings where a picture is optional: a social image, a logo.
 */
export function optionalMediaValue(siteId: string) {
  return z
    .string()
    .default('')
    .transform((value, ctx) => {
      if (value.trim() === '') return '';
      const file = mediaValue(siteId).safeParse(value);
      if (file.success) return file.data;
      for (const issue of file.error.issues) ctx.addIssue({ code: 'custom', message: issue.message });
      return z.NEVER;
    });
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

const NOTHING_VISIBLE = /<[^>]*>|&nbsp;|\s/g;

/** Nothing there: empty, only spaces, a link with no address, or formatted text with no words in it. */
const isBlank = (value: unknown, kind?: FieldKind): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    if (value.trim() === '') return true;
    return kind === 'richText' && value.replace(NOTHING_VISIBLE, '') === '';
  }
  if (typeof value === 'object' && 'href' in value) return String((value as { href: unknown }).href).trim() === '';
  return false;
};

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
    if (isBlank(value, field.kind)) {
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
  return fields.filter((field) => field.required && isBlank(saved[field.key], field.kind));
}
