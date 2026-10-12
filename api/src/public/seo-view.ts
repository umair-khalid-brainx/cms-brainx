import { readSeo } from '../content/seo.js';
import type { PublicField } from './entry-view.js';

// What a search engine or a link preview gets for a page (SEO-01): what staff entered,
// with sensible fallbacks for what they left empty, resolved here so each rule can be
// tested. `web` only turns this into tags. Nothing is cleaned: the settings were checked
// when they were saved (invariant 5).

export type SeoImage = { url: string; alt: string };

export type PublicSeo = {
  /** The browser tab and search-result title. */
  title: string;
  description: string | null;
  /** Only what staff entered; `web` falls back to the page's own address, which it alone knows. */
  canonicalUrl: string | null;
  noindex: boolean;
  /** The title, description and picture shown when the page is shared. */
  social: { title: string; description: string | null; image: SeoImage | null };
};

const DESCRIPTION_LENGTH = 160;

const blank = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** Cut at a word, with an ellipsis, so a long summary still fits a search result. */
function shorten(text: string): string {
  if (text.length <= DESCRIPTION_LENGTH) return text;
  const cut = text.slice(0, DESCRIPTION_LENGTH);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), DESCRIPTION_LENGTH - 20)).trimEnd()}…`;
}

/** The first short-text field with a value: an entry's excerpt or summary. */
export function entrySummary(fields: readonly PublicField[] | undefined): string | null {
  const text = fields?.find((field) => field.kind === 'text');
  return text && text.kind === 'text' ? blank(text.text) : null;
}

/** The first picture field with a value: an entry's featured image. */
export function entryPicture(fields: readonly PublicField[] | undefined): SeoImage | null {
  const picture = fields?.find((field) => field.kind === 'media' && field.file.isImage);
  return picture && picture.kind === 'media' ? { url: picture.file.url, alt: picture.file.alt } : null;
}

export function buildSeo(input: {
  page: { title: string; path: string; seo: unknown };
  siteName: string;
  /** An entry's own fields, for the description and picture fallbacks. Empty for an ordinary page. */
  entryFields?: readonly PublicField[];
  /** The chosen social image, when it is still in the library. */
  socialImage: SeoImage | null;
  /** The site's logo (GOV-04): the last resort when there's no social image and no featured picture. */
  siteLogo?: SeoImage | null;
}): PublicSeo {
  const seo = readSeo(input.page.seo);
  const title = blank(seo.metaTitle) ?? (input.page.path === '/' ? input.siteName : `${input.page.title} · ${input.siteName}`);
  const summary = entrySummary(input.entryFields);
  const description = blank(seo.metaDescription) ?? (summary ? shorten(summary) : null);
  return {
    title,
    description,
    canonicalUrl: blank(seo.canonicalUrl),
    noindex: seo.noindex,
    social: {
      // Social text falls back to the meta text, then to the page's own.
      title: blank(seo.ogTitle) ?? title,
      description: blank(seo.ogDescription) ?? description,
      image: input.socialImage ?? entryPicture(input.entryFields) ?? input.siteLogo ?? null,
    },
  };
}
