import type { FieldDefinition, FieldKind } from '../content-types/field-definitions.js';
import { visibleFields } from '../content-types/field-definitions.js';

// What the public site shows of an entry's custom fields (TYP-03): the type's visible
// fields, in its order, each with its value shaped for display. Fields with no value, and
// files that are no longer in the library, are left out. Nothing here is cleaned: the
// values were checked and sanitised when they were saved (invariant 5).

export type FileInfo = { mimetype: string; alt: string | null; title: string | null };

export type PublicFile = { url: string; name: string; alt: string; mimetype: string; isImage: boolean };

export type PublicField =
  | { key: string; label: string; kind: 'text' | 'select'; text: string }
  | { key: string; label: string; kind: 'richText'; html: string }
  | { key: string; label: string; kind: 'date'; date: string }
  | { key: string; label: string; kind: 'link'; link: { label: string; href: string } }
  | { key: string; label: string; kind: 'media'; file: PublicFile };

/** The library file names an entry's media fields point at, to look them up in one query. */
export function mediaFilenames(fields: readonly FieldDefinition[], data: unknown): string[] {
  const saved = asRecord(data);
  const names = new Set<string>();
  for (const field of visibleFields(fields)) {
    const value = saved[field.key];
    if (field.kind === 'media' && typeof value === 'string') names.add(fileNameOf(value));
  }
  return [...names].filter(Boolean);
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const fileNameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

export function buildEntryFields(
  fields: readonly FieldDefinition[],
  data: unknown,
  files: ReadonlyMap<string, FileInfo>,
  origin: string,
): PublicField[] {
  const saved = asRecord(data);
  const out: PublicField[] = [];

  for (const field of visibleFields(fields)) {
    const value = saved[field.key];
    const base = { key: field.key, label: field.label };
    switch (field.kind satisfies FieldKind) {
      case 'text':
        if (typeof value === 'string' && value !== '') out.push({ ...base, kind: 'text', text: value });
        break;
      case 'select':
        if (typeof value === 'string' && value !== '') out.push({ ...base, kind: 'select', text: value });
        break;
      case 'richText':
        if (typeof value === 'string' && value !== '') out.push({ ...base, kind: 'richText', html: value });
        break;
      case 'date':
        if (typeof value === 'string' && value !== '') out.push({ ...base, kind: 'date', date: value });
        break;
      case 'link': {
        const link = asRecord(value);
        if (typeof link.href === 'string' && link.href !== '') {
          out.push({ ...base, kind: 'link', link: { label: typeof link.label === 'string' ? link.label : '', href: link.href } });
        }
        break;
      }
      case 'media': {
        if (typeof value !== 'string') break;
        const name = fileNameOf(value);
        const info = files.get(name);
        if (!info) break; // the file was deleted from the library
        out.push({
          ...base,
          kind: 'media',
          file: {
            url: `${origin}${value}`,
            name: info.title || name,
            alt: info.alt ?? '',
            mimetype: info.mimetype,
            isImage: info.mimetype.startsWith('image/'),
          },
        });
        break;
      }
    }
  }
  return out;
}

export type ListingItem = {
  title: string;
  path: string;
  publishedAt: string | null;
  /** The first short-text field with a value, cut to a sentence or two for a list. */
  summary: string | null;
  /** The first picture field that has one. */
  image: { url: string; alt: string } | null;
};

const SUMMARY_LENGTH = 200;

export function listingItem(
  row: { title: string; path: string; publishedAt: Date | null; data: unknown },
  fields: readonly FieldDefinition[],
  files: ReadonlyMap<string, FileInfo>,
  origin: string,
): ListingItem {
  const shaped = buildEntryFields(fields, row.data, files, origin);
  const text = shaped.find((field) => field.kind === 'text');
  const picture = shaped.find((field) => field.kind === 'media' && field.file.isImage);
  const summary = text && text.kind === 'text' ? text.text : null;
  return {
    title: row.title,
    path: row.path,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    summary: summary && summary.length > SUMMARY_LENGTH ? `${summary.slice(0, SUMMARY_LENGTH).trimEnd()}…` : summary,
    image: picture && picture.kind === 'media' ? { url: picture.file.url, alt: picture.file.alt } : null,
  };
}
