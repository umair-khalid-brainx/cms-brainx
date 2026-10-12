// A page's search and sharing settings (SEO-01), as the editor shows them. The API checks
// and stores them (api/src/content/seo.ts) and applies the fallbacks for the public site
// (api/src/public/seo-view.ts); this only guides: counters and previews of what staff typed.

export type Seo = {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  /** A file in the site's media library, or empty. */
  ogImage: string;
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

/** About how much of each search engines usually show before cutting it. Advice, not a limit. */
export const TITLE_ADVICE = 60;
export const DESCRIPTION_ADVICE = 160;

/** The API's hard limits (api/src/content/seo.ts; the repos can't share code, so keep these in step). */
export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 320;
export const CANONICAL_MAX = 500;

/** What the API sent, with anything missing or malformed treated as empty. */
export function readSeo(raw: unknown): Seo {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return EMPTY_SEO;
  const record = raw as Record<string, unknown>;
  const text = (key: keyof Seo) => (typeof record[key] === 'string' ? (record[key] as string) : '');
  return {
    metaTitle: text('metaTitle'),
    metaDescription: text('metaDescription'),
    canonicalUrl: text('canonicalUrl'),
    ogTitle: text('ogTitle'),
    ogDescription: text('ogDescription'),
    ogImage: text('ogImage'),
    noindex: record.noindex === true,
  };
}

export function sameSeo(a: Seo, b: Seo): boolean {
  return (Object.keys(EMPTY_SEO) as (keyof Seo)[]).every((key) => a[key] === b[key]);
}

const blank = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** The title a search result shows: the meta title, else the page's own with the site's name. */
export function searchTitle(seo: Seo, page: { title: string; path: string }, siteName: string): string {
  return blank(seo.metaTitle) ?? (page.path === '/' ? siteName : `${page.title} · ${siteName}`);
}

/** The title a shared link shows: the social title, else the search title. */
export function socialTitle(seo: Seo, page: { title: string; path: string }, siteName: string): string {
  return blank(seo.ogTitle) ?? searchTitle(seo, page, siteName);
}

export function socialDescription(seo: Seo): string | null {
  return blank(seo.ogDescription) ?? blank(seo.metaDescription);
}

export type Length = { count: number; advice: number; over: boolean };

/** How long a text is next to what search engines usually show; counts what's typed, trimmed like the API will. */
export function lengthOf(text: string, advice: number): Length {
  const count = text.trim().length;
  return { count, advice, over: count > advice };
}
