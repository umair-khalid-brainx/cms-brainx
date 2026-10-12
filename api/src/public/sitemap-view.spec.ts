import { buildSitemap, type SitemapRow } from './sitemap-view.js';

const at = (day: number) => new Date(`2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`);
const page = (path: string, day: number, seo: unknown = {}): SitemapRow => ({ path, typeId: null, seo, updatedAt: at(day) });
const entry = (path: string, day: number, seo: unknown = {}): SitemapRow => ({ path, typeId: 't1', seo, updatedAt: at(day) });
const paths = (rows: SitemapRow[], limit?: number) => buildSitemap(rows, limit).entries.map((e) => e.path);

describe('buildSitemap (SEO-02)', () => {
  it('lists pages and entries with when they last changed, in address order', () => {
    expect(buildSitemap([page('/about', 3), page('/', 1)])).toEqual({
      entries: [
        { path: '/', lastModified: '2026-10-01T10:00:00.000Z', canonicalUrl: null },
        { path: '/about', lastModified: '2026-10-03T10:00:00.000Z', canonicalUrl: null },
      ],
      truncated: false,
    });
  });

  it('leaves out a page switched to noindex, and anything with a malformed setting counts as indexable', () => {
    const rows = [page('/hidden', 2, { noindex: true }), page('/shown', 2, { noindex: false }), page('/junk', 2, 'junk')];
    expect(paths(rows)).toEqual(['/junk', '/shown']);
  });

  it('sends a canonical address along, for web to compare with the page’s own', () => {
    const { entries } = buildSitemap([page('/a', 1, { canonicalUrl: ' https://other.example/a ' }), page('/b', 1)]);
    expect(entries.map((e) => e.canonicalUrl)).toEqual(['https://other.example/a', null]);
  });

  it('adds a listing for each type with entries, as new as its newest entry', () => {
    const { entries } = buildSitemap([entry('/blog/old', 2), entry('/blog/new', 9), entry('/events/fair', 4)]);
    expect(entries.find((e) => e.path === '/blog')).toEqual({ path: '/blog', lastModified: '2026-10-09T10:00:00.000Z', canonicalUrl: null });
    expect(entries.find((e) => e.path === '/events')?.lastModified).toBe('2026-10-04T10:00:00.000Z');
  });

  it('offers no listing when every entry of the type is noindex, and none for a type with no entries', () => {
    expect(paths([entry('/blog/secret', 2, { noindex: true }), page('/about', 1)])).toEqual(['/about']);
  });

  it('never goes past the limit: the last pages go, the listings stay, and it says so', () => {
    const rows = [entry('/blog/a', 1), page('/a', 1), page('/b', 1), page('/c', 1), page('/d', 1)];
    const result = buildSitemap(rows, 4);
    expect(result.entries.map((e) => e.path)).toEqual(['/a', '/b', '/blog', '/blog/a']);
    expect(result.truncated).toBe(true);
  });

  it('is not truncated when everything fits exactly', () => {
    expect(buildSitemap([page('/a', 1), page('/b', 1)], 2).truncated).toBe(false);
  });

  it('is empty for a site with nothing live', () => {
    expect(buildSitemap([])).toEqual({ entries: [], truncated: false });
  });
});
