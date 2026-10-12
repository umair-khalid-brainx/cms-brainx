import type { SitemapEntry } from './publicApi';

// A tenant's sitemap.xml and robots.txt (SEO-02), written out from the addresses `api` sends.
// The entries are only what is live and indexable; this adds the host and the XML.

const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Compared without a trailing slash, so `…/about/` and `…/about` are the same address. */
const same = (a: string, b: string): boolean => a.replace(/\/+$/, '') === b.replace(/\/+$/, '');

/**
 * The sitemaps.org format: one `<url>` per address, with when it last changed. A sitemap lists
 * canonical addresses, so a page whose own canonical link names another address is left out
 * (SEO-01); one that names itself stays.
 */
export function sitemapXml(origin: string, entries: readonly SitemapEntry[]): string {
  const urls = entries
    .filter((entry) => entry.canonicalUrl === null || same(entry.canonicalUrl, `${origin}${entry.path}`))
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(`${origin}${entry.path}`)}</loc>\n    <lastmod>${escapeXml(entry.lastModified)}</lastmod>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}${urls ? '\n' : ''}</urlset>\n`;
}

/** Everything may be crawled, and the sitemap is named so crawlers find it without being told. */
export function robotsTxt(origin: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
}
