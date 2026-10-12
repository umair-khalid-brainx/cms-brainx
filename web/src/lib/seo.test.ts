import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { listingMetadata, notFoundMetadata, pageMetadata, siteOrigin } from './seo.ts';
import type { PublicSeo } from './publicApi';

const base: PublicSeo = {
  title: 'About us · Corrick',
  description: null,
  canonicalUrl: null,
  noindex: false,
  social: { title: 'About us · Corrick', description: null, image: null },
};
const input = { origin: 'https://corrick.example.com', path: '/about', siteName: 'Corrick', article: false };

describe('pageMetadata (SEO-01)', () => {
  it('title, the page’s own address as canonical, a website card with no picture, and no description or robots', () => {
    const meta = pageMetadata({ ...input, seo: base });
    assert.equal(meta.title, 'About us · Corrick');
    assert.equal(meta.alternates?.canonical, 'https://corrick.example.com/about');
    assert.equal(meta.description, undefined);
    assert.equal(meta.robots, undefined);
    assert.equal((meta.openGraph as { type: string }).type, 'website');
    assert.equal((meta.twitter as { card: string }).card, 'summary');
    assert.equal((meta.openGraph as { images?: unknown }).images, undefined);
  });

  it('a canonical address staff entered wins, in the tag and in og:url', () => {
    const meta = pageMetadata({ ...input, seo: { ...base, canonicalUrl: 'https://other.example/a' } });
    assert.equal(meta.alternates?.canonical, 'https://other.example/a');
    assert.equal((meta.openGraph as { url: string }).url, 'https://other.example/a');
  });

  it('noindex becomes robots index:false, follow:false', () => {
    assert.deepEqual(pageMetadata({ ...input, seo: { ...base, noindex: true } }).robots, { index: false, follow: false });
  });

  it('a description and a picture add their tags, and the card becomes large', () => {
    const meta = pageMetadata({
      ...input,
      seo: { ...base, description: 'Who we are', social: { title: 'S', description: 'Share text', image: { url: 'https://api/x.png', alt: 'A farm' } } },
    });
    assert.equal(meta.description, 'Who we are');
    const og = meta.openGraph as { description: string; images: { url: string; alt: string }[]; title: string };
    assert.equal(og.title, 'S');
    assert.equal(og.description, 'Share text');
    assert.deepEqual(og.images, [{ url: 'https://api/x.png', alt: 'A farm' }]);
    const twitter = meta.twitter as { card: string; images: string[] };
    assert.equal(twitter.card, 'summary_large_image');
    assert.deepEqual(twitter.images, ['https://api/x.png']);
  });

  it('an entry is an article', () => {
    assert.equal((pageMetadata({ ...input, seo: base, article: true }).openGraph as { type: string }).type, 'article');
  });
});

describe('listingMetadata and notFoundMetadata', () => {
  it('a listing has its own title and address', () => {
    const meta = listingMetadata({ origin: input.origin, path: '/blog', typeName: 'Posts', siteName: 'Corrick' });
    assert.equal(meta.title, 'Posts · Corrick');
    assert.equal(meta.alternates?.canonical, 'https://corrick.example.com/blog');
  });

  it('a listing uses the site’s logo as its card picture when there is one', () => {
    const meta = listingMetadata({ origin: input.origin, path: '/blog', typeName: 'Posts', siteName: 'Corrick', logoUrl: 'https://api/logo.png' });
    assert.deepEqual((meta.openGraph as { images: unknown }).images, [{ url: 'https://api/logo.png', alt: 'Corrick' }]);
    assert.equal((meta.twitter as { card: string }).card, 'summary_large_image');
    assert.equal((listingMetadata({ origin: input.origin, path: '/blog', typeName: 'Posts', siteName: 'Corrick' }).twitter as { card: string }).card, 'summary');
  });

  it('a missing page says so, on the site’s name (B-15)', () => {
    assert.equal(notFoundMetadata('Corrick').title, 'Page not found · Corrick');
  });
});

describe('siteOrigin', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('uses the template, dropping a trailing slash', () => {
    process.env.PUBLIC_SITE_URL_TEMPLATE = 'https://{subdomain}.example.com/';
    assert.equal(siteOrigin('corrick'), 'https://corrick.example.com');
  });

  it('in production without a template: https on the root domain, never a development address', () => {
    delete process.env.PUBLIC_SITE_URL_TEMPLATE;
    Object.assign(process.env, { NODE_ENV: 'production', PUBLIC_ROOT_DOMAIN: 'sites.example.com' });
    assert.equal(siteOrigin('corrick'), 'https://corrick.sites.example.com');
  });

  it('in development without a template: the local address', () => {
    delete process.env.PUBLIC_SITE_URL_TEMPLATE;
    Object.assign(process.env, { NODE_ENV: 'development' });
    assert.equal(siteOrigin('corrick'), 'http://corrick.lvh.me:3000');
  });
});
