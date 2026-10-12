import { EMPTY_SEO, parseSeo, readSeo } from './seo.js';

const SITE = 'cmv51abc123';

describe('parseSeo (SEO-01)', () => {
  it('takes nothing as all empty, with noindex off', () => {
    expect(parseSeo({}, SITE)).toEqual({ ok: true, seo: EMPTY_SEO });
  });

  it('trims text and keeps what is valid', () => {
    const result = parseSeo(
      { metaTitle: '  About us  ', metaDescription: 'Who we are', canonicalUrl: 'https://example.com/about', noindex: true },
      SITE,
    );
    expect(result).toMatchObject({ ok: true, seo: { metaTitle: 'About us', canonicalUrl: 'https://example.com/about', noindex: true } });
  });

  it('refuses over-long text, naming the field', () => {
    const result = parseSeo({ metaTitle: 'x'.repeat(121), ogDescription: 'y'.repeat(321) }, SITE);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problems.join(' ')).toMatch(/meta title.*120/);
    expect(!result.ok && result.problems.join(' ')).toMatch(/social description.*320/);
  });

  it('only lets a full http(s) address be the canonical one', () => {
    for (const bad of ['/about', 'javascript:alert(1)', 'ftp://x.com/a', 'not a url', 'https://user:pw@x.com/', 'https://']) {
      expect(parseSeo({ canonicalUrl: bad }, SITE).ok).toBe(false);
    }
    expect(parseSeo({ canonicalUrl: 'http://example.com' }, SITE).ok).toBe(true);
  });

  it('only lets the social image be a file from this site’s own library, and stores the short form', () => {
    expect(parseSeo({ ogImage: `http://localhost:4001/uploads/${SITE}/a1-b2.png` }, SITE)).toMatchObject({
      ok: true,
      seo: { ogImage: `/uploads/${SITE}/a1-b2.png` },
    });
    for (const bad of ['/uploads/othersite/a.png', 'https://evil.com/a.png', 'javascript:alert(1)', `/uploads/${SITE}/../x.png`]) {
      const result = parseSeo({ ogImage: bad }, SITE);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.problems).toEqual(['Choose a file from this site’s media library']);
    }
  });

  it('refuses a wrong type', () => {
    expect(parseSeo({ noindex: 'yes' }, SITE).ok).toBe(false);
  });
});

describe('readSeo', () => {
  it('reads back what was stored, and treats anything missing or malformed as empty', () => {
    expect(readSeo({ metaTitle: 'A', noindex: true, ogImage: 5 })).toEqual({ ...EMPTY_SEO, metaTitle: 'A', noindex: true });
    expect(readSeo(null)).toEqual(EMPTY_SEO);
    expect(readSeo([])).toEqual(EMPTY_SEO);
  });
});
