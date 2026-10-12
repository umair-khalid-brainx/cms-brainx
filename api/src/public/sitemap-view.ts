import { readSeo } from '../content/seo.js';

// The addresses a site wants search engines to find (SEO-02): its live pages and entries,
// and a listing page for each type that has some. Pure, so each rule is tested. Never a
// draft or archived page (the repository only returns live ones), never a page switched to
// noindex (SEO-01), and never a category or tag archive (they are noindex by default). A page
// whose canonical address is another one is sent with that address, and `web`, which knows the
// site's origin, leaves it out: the sitemap lists canonical addresses only.

/** A sitemap file may hold at most this many addresses (sitemaps.org). */
export const SITEMAP_LIMIT = 50_000;

export type SitemapRow = { path: string; typeId: string | null; seo: unknown; updatedAt: Date };

export type SitemapEntry = {
  path: string;
  lastModified: string;
  /** The canonical address staff entered, if any; `web` drops the entry when it isn't this page's own. */
  canonicalUrl: string | null;
};

/** `truncated`: some addresses didn't fit in one file and were left out. */
export type Sitemap = { entries: SitemapEntry[]; truncated: boolean };

export function buildSitemap(rows: readonly SitemapRow[], limit = SITEMAP_LIMIT): Sitemap {
  const indexable = rows.filter((row) => !readSeo(row.seo).noindex);

  // A type's listing (`/blog`) is as new as its newest entry. A listing of nothing isn't offered.
  const listings = new Map<string, Date>();
  for (const row of indexable) {
    if (row.typeId === null) continue;
    const listing = `/${row.path.split('/')[1]}`;
    const newest = listings.get(listing);
    if (!newest || row.updatedAt > newest) listings.set(listing, row.updatedAt);
  }
  // Past the limit the listings are kept and the last pages (by address) are left out, so the file
  // stays valid; the listings are few and each stands for many entries.
  const sorted = indexable
    .map((row) => ({
      path: row.path,
      lastModified: row.updatedAt.toISOString(),
      canonicalUrl: readSeo(row.seo).canonicalUrl.trim() || null,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const pages = sorted.slice(0, Math.max(0, limit - listings.size));
  const entries = [
    ...pages,
    ...[...listings].map(([path, updatedAt]) => ({ path, lastModified: updatedAt.toISOString(), canonicalUrl: null })),
  ];

  return { entries: entries.sort((a, b) => a.path.localeCompare(b.path)), truncated: pages.length < sorted.length };
}
