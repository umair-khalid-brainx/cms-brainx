import { describe, expect, it } from 'vitest';
import { EMPTY_SEO, lengthOf, readSeo, sameSeo, searchTitle, socialDescription, socialTitle } from './seo';

const page = { title: 'About us', path: '/about' };

describe('searchTitle and socialTitle', () => {
  it('fall back the way the public site does', () => {
    expect(searchTitle(EMPTY_SEO, page, 'Corrick')).toBe('About us · Corrick');
    expect(searchTitle(EMPTY_SEO, { title: 'Home', path: '/' }, 'Corrick')).toBe('Corrick');
    expect(searchTitle({ ...EMPTY_SEO, metaTitle: '  About the farm ' }, page, 'Corrick')).toBe('About the farm');
    expect(socialTitle({ ...EMPTY_SEO, metaTitle: 'A' }, page, 'C')).toBe('A');
    expect(socialTitle({ ...EMPTY_SEO, metaTitle: 'A', ogTitle: 'B' }, page, 'C')).toBe('B');
  });
});

describe('socialDescription', () => {
  it('uses its own, else the meta description, else nothing', () => {
    expect(socialDescription(EMPTY_SEO)).toBeNull();
    expect(socialDescription({ ...EMPTY_SEO, metaDescription: 'M' })).toBe('M');
    expect(socialDescription({ ...EMPTY_SEO, metaDescription: 'M', ogDescription: 'O' })).toBe('O');
  });
});

describe('readSeo and sameSeo', () => {
  it('treats anything missing or malformed as empty', () => {
    expect(readSeo(undefined)).toEqual(EMPTY_SEO);
    expect(readSeo({ metaTitle: 'A', noindex: true, ogImage: 7 })).toEqual({ ...EMPTY_SEO, metaTitle: 'A', noindex: true });
  });

  it('compares every field', () => {
    expect(sameSeo(EMPTY_SEO, { ...EMPTY_SEO })).toBe(true);
    expect(sameSeo(EMPTY_SEO, { ...EMPTY_SEO, noindex: true })).toBe(false);
    expect(sameSeo(EMPTY_SEO, { ...EMPTY_SEO, ogImage: '/x' })).toBe(false);
  });
});

describe('lengthOf', () => {
  it('counts the trimmed text against the advice', () => {
    expect(lengthOf('  hello  ', 60)).toEqual({ count: 5, advice: 60, over: false });
    expect(lengthOf('x'.repeat(61), 60).over).toBe(true);
  });
});
