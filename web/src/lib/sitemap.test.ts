import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { robotsTxt, sitemapXml } from './sitemap.ts';

const origin = 'https://corrick.example.com';

describe('sitemapXml (SEO-02)', () => {
  it('writes one url per address, on the site’s own host, with when it changed', () => {
    const xml = sitemapXml(origin, [
      { path: '/', lastModified: '2026-10-01T10:00:00.000Z', canonicalUrl: null },
      { path: '/about', lastModified: '2026-10-03T10:00:00.000Z', canonicalUrl: null },
    ]);
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
    assert.ok(xml.includes('<loc>https://corrick.example.com/</loc>\n    <lastmod>2026-10-01T10:00:00.000Z</lastmod>'));
    assert.ok(xml.includes('<loc>https://corrick.example.com/about</loc>'));
    assert.equal(xml.match(/<url>/g)?.length, 2);
    assert.ok(xml.endsWith('</urlset>\n'));
  });

  it('escapes what XML can’t hold, so an address can never break the file or add elements', () => {
    const xml = sitemapXml(origin, [{ path: '/a&b<c>"d\'', lastModified: '2026-10-01T10:00:00.000Z', canonicalUrl: null }]);
    assert.ok(xml.includes('<loc>https://corrick.example.com/a&amp;b&lt;c&gt;&quot;d&apos;</loc>'));
    assert.ok(!xml.includes('<c>'));
  });

  it('leaves out a page whose canonical address is another one, and keeps one that names itself', () => {
    const at = '2026-10-01T10:00:00.000Z';
    const xml = sitemapXml(origin, [
      { path: '/moved', lastModified: at, canonicalUrl: 'https://elsewhere.example/moved' },
      { path: '/self', lastModified: at, canonicalUrl: 'https://corrick.example.com/self/' },
      { path: '/plain', lastModified: at, canonicalUrl: null },
    ]);
    assert.ok(!xml.includes('/moved'));
    assert.ok(xml.includes('<loc>https://corrick.example.com/self</loc>'));
    assert.ok(xml.includes('<loc>https://corrick.example.com/plain</loc>'));
  });

  it('is still a valid, empty urlset for a site with nothing live', () => {
    assert.equal(sitemapXml(origin, []), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n');
  });
});

describe('robotsTxt', () => {
  it('allows everything and names this host’s sitemap', () => {
    assert.equal(robotsTxt(origin), 'User-agent: *\nAllow: /\n\nSitemap: https://corrick.example.com/sitemap.xml\n');
  });
});
