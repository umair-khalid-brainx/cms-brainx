import { z } from 'zod';
import { mediaValue } from '../content-types/field-values.js';

// Search and social-sharing settings of a page or entry (SEO-01), stored whole in
// `Content.seo`. Every field is optional text: empty means "use the page's own title and
// text" (public/seo-view.ts). The editor shows 60 and 160 characters as the length search
// engines usually show; the limits here are looser, so a longer text is allowed but flagged.

export const SEO_TITLE_MAX = 120;
export const SEO_DESCRIPTION_MAX = 320;

export type Seo = {
  metaTitle: string;
  metaDescription: string;
  /** A full http(s) address, or empty for the page's own. */
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  /** A file in this site's media library (`/uploads/<site>/<file>`), or empty. */
  ogImage: string;
  /** Tells search engines not to list the page; it also leaves the sitemap (SEO-02). */
  noindex: boolean;
};

export const EMPTY_SEO: Seo = {
  metaTitle: '',
  metaDescription: '',
  canonicalUrl: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  noindex: false,
};

const text = (max: number, what: string) =>
  z.string().trim().max(max, `${what} can be at most ${max} characters.`).default('');

/** An absolute http(s) address, or empty. Nothing else can become a canonical link. */
const canonicalUrl = z
  .string()
  .trim()
  .max(500, 'The canonical address can be at most 500 characters.')
  .default('')
  .refine((value) => {
    if (value === '') return true;
    try {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'The canonical address must be a full address starting with https:// (or http://).');

/** The rules for one site: the social image must be a file from its own media library. */
export function seoSchema(siteId: string) {
  return z.object({
    metaTitle: text(SEO_TITLE_MAX, 'The meta title'),
    metaDescription: text(SEO_DESCRIPTION_MAX, 'The meta description'),
    canonicalUrl,
    ogTitle: text(SEO_TITLE_MAX, 'The social title'),
    ogDescription: text(SEO_DESCRIPTION_MAX, 'The social description'),
    // Empty, or a library file of this site; the library rule's own message otherwise.
    ogImage: z
      .string()
      .default('')
      .transform((value, ctx) => {
        if (value.trim() === '') return '';
        const file = mediaValue(siteId).safeParse(value);
        if (file.success) return file.data;
        for (const issue of file.error.issues) ctx.addIssue({ code: 'custom', message: issue.message });
        return z.NEVER;
      }),
    noindex: z.boolean().default(false),
  });
}

export type SeoResult = { ok: true; seo: Seo } | { ok: false; problems: string[] };

/** What is allowed to be stored, or every problem in words for the person; never throws. */
export function parseSeo(input: unknown, siteId: string): SeoResult {
  const parsed = seoSchema(siteId).safeParse(input);
  if (parsed.success) return { ok: true, seo: parsed.data };
  return { ok: false, problems: [...new Set(parsed.error.issues.map((issue) => issue.message))] };
}

/** A stored value read back: whatever is there, with anything missing or malformed treated as empty. */
export function readSeo(stored: unknown): Seo {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return EMPTY_SEO;
  const record = stored as Record<string, unknown>;
  const str = (key: keyof Seo) => (typeof record[key] === 'string' ? (record[key] as string) : '');
  return {
    metaTitle: str('metaTitle'),
    metaDescription: str('metaDescription'),
    canonicalUrl: str('canonicalUrl'),
    ogTitle: str('ogTitle'),
    ogDescription: str('ogDescription'),
    ogImage: str('ogImage'),
    noindex: record.noindex === true,
  };
}
