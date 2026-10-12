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

export type EntryTerm = { name: string; slug: string };

export type EntryView = {
  type: EntryType;
  /** The author's name only. */
  author: string | null;
  publishedAt: string | null;
  fields: EntryField[];
  /** A category or tag of the entry, shown as a link to its archive (TAX-02). Absent from older answers. */
  categories?: EntryTerm[];
  tags?: EntryTerm[];
  /** Up to three entries of the same type sharing a category, else a tag; empty or absent when none. */
  related?: ListingEntry[];
};

export type ListingEntry = {
  title: string;
  path: string;
  publishedAt: string | null;
  summary: string | null;
  image: { url: string; alt: string } | null;
};

export type TypeListing = { type: EntryType; entries: ListingEntry[] };

export type TermKind = 'category' | 'tag';

/** A category or tag and one page of its published entries, newest first (TAX-02). */
export type TermArchiveView = {
  term: { name: string; slug: string; kind: TermKind };
  entries: ListingEntry[];
  page: number;
  pageCount: number;
  total: number;
};

/** The archive's address: `/category/news`, and `/category/news/page/2` after the first page. */
export function termHref(kind: TermKind, slug: string, page = 1): string {
  const base = `/${kind}/${encodeURIComponent(slug)}`;
  return page > 1 ? `${base}/page/${page}` : base;
}

const LONG_DATE = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "2026-11-02" or a full timestamp as "2 November 2026". Empty for anything that isn't a date. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? '' : LONG_DATE.format(date);
}
