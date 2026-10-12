import { buildSeo, entryPicture, entrySummary } from './seo-view.js';
import type { PublicField } from './entry-view.js';

const page = { title: 'About us', path: '/about', seo: {} };
const image = { url: 'http://api/uploads/s/a.png', alt: 'A farm' };

describe('buildSeo fallbacks (SEO-01)', () => {
  it('with nothing entered: the page’s title and the site’s name, no description, own address, indexable', () => {
    expect(buildSeo({ page, siteName: 'Corrick', socialImage: null })).toEqual({
      title: 'About us · Corrick',
      description: null,
      canonicalUrl: null,
      noindex: false,
      social: { title: 'About us · Corrick', description: null, image: null },
    });
  });

  it('the home page is just the site’s name', () => {
    expect(buildSeo({ page: { ...page, path: '/', title: 'Home' }, siteName: 'Corrick', socialImage: null }).title).toBe('Corrick');
  });

  it('what staff entered wins, and social text falls back to the meta text', () => {
    const seo = buildSeo({
      page: { ...page, seo: { metaTitle: 'About the farm', metaDescription: 'Who we are', canonicalUrl: 'https://example.com/a', noindex: true } },
      siteName: 'Corrick',
      socialImage: image,
    });
    expect(seo).toMatchObject({
      title: 'About the farm',
      description: 'Who we are',
      canonicalUrl: 'https://example.com/a',
      noindex: true,
      social: { title: 'About the farm', description: 'Who we are', image },
    });
  });

  it('a social title and description of their own win over the meta ones', () => {
    const seo = buildSeo({
      page: { ...page, seo: { metaTitle: 'A', ogTitle: 'B', metaDescription: 'C', ogDescription: 'D' } },
      siteName: 'S',
      socialImage: null,
    });
    expect(seo.social).toMatchObject({ title: 'B', description: 'D' });
  });

  it('an entry: description from its summary (cut to a search result), picture from its featured image', () => {
    const long = `${'word '.repeat(60)}end`;
    const fields: PublicField[] = [
      { key: 'excerpt', label: 'Excerpt', kind: 'text', text: long },
      { key: 'image', label: 'Image', kind: 'media', file: { url: image.url, name: 'a', alt: image.alt, mimetype: 'image/png', isImage: true } },
    ];
    const seo = buildSeo({ page, siteName: 'Corrick', entryFields: fields, socialImage: null });
    expect(seo.description!.length).toBeLessThanOrEqual(161);
    expect(seo.description!.endsWith('…')).toBe(true);
    expect(seo.social.image).toEqual(image);
  });

  it('the site’s logo is the last resort: after the chosen image and the featured one', () => {
    const logo = { url: 'http://api/logo.png', alt: 'Corrick' };
    expect(buildSeo({ page, siteName: 'S', socialImage: null, siteLogo: logo }).social.image).toEqual(logo);
    expect(buildSeo({ page, siteName: 'S', socialImage: image, siteLogo: logo }).social.image).toEqual(image);
    const fields: PublicField[] = [
      { key: 'image', label: 'Image', kind: 'media', file: { url: 'http://x/feat.png', name: 'f', alt: 'Featured', mimetype: 'image/png', isImage: true } },
    ];
    expect(buildSeo({ page, siteName: 'S', entryFields: fields, socialImage: null, siteLogo: logo }).social.image?.url).toBe('http://x/feat.png');
  });

  it('the chosen social image wins over the featured image', () => {
    const fields: PublicField[] = [
      { key: 'image', label: 'Image', kind: 'media', file: { url: 'http://x/other.png', name: 'o', alt: '', mimetype: 'image/png', isImage: true } },
    ];
    expect(buildSeo({ page, siteName: 'S', entryFields: fields, socialImage: image }).social.image).toEqual(image);
  });

  it('treats blank (spaces only) as empty, and malformed stored settings as empty', () => {
    expect(buildSeo({ page: { ...page, seo: { metaTitle: '   ' } }, siteName: 'S', socialImage: null }).title).toBe('About us · S');
    expect(buildSeo({ page: { ...page, seo: 'junk' }, siteName: 'S', socialImage: null }).noindex).toBe(false);
  });
});

describe('entry fallbacks', () => {
  it('skips documents and empty text', () => {
    const fields: PublicField[] = [
      { key: 't', label: 'T', kind: 'text', text: '  ' },
      { key: 'd', label: 'D', kind: 'media', file: { url: 'u', name: 'n', alt: '', mimetype: 'application/pdf', isImage: false } },
    ];
    expect(entrySummary(fields)).toBeNull();
    expect(entryPicture(fields)).toBeNull();
    expect(entrySummary(undefined)).toBeNull();
  });
});
