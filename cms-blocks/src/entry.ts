// What `api` sends the public site for an entry of a content type, and for a
// type's listing (TYP-03). Mirrors api/src/public/entry-view.ts by hand: the two
// repos share no code, only this shape.

export type EntryFile = { url: string; name: string; alt: string; mimetype: string; isImage: boolean };

export type EntryField =
  | { key: string; label: string; kind: 'text' | 'select'; text: string }
  | { key: string; label: string; kind: 'richText'; html: string }
  | { key: string; label: string; kind: 'date'; date: string }
  | { key: string; label: string; kind: 'link'; link: { label: string; href: string } }
  | { key: string; label: string; kind: 'media'; file: EntryFile };

export type EntryType = { name: string; singularName: string; prefix: string };

export type EntryView = {
  type: EntryType;
  /** The author's name only. */
  author: string | null;
  publishedAt: string | null;
  fields: EntryField[];
};

export type ListingEntry = {
  title: string;
  path: string;
  publishedAt: string | null;
  summary: string | null;
  image: { url: string; alt: string } | null;
};

export type TypeListing = { type: EntryType; entries: ListingEntry[] };

const LONG_DATE = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "2026-11-02" or a full timestamp as "2 November 2026". Empty for anything that isn't a date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? '' : LONG_DATE.format(date);
}
