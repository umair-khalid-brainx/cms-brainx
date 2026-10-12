import { normaliseSlug, SLUG_MAX, slugProblem } from './slug.js';

// The same cases as the other side's normaliser test (api/src/content/slug.spec.ts and
// admin/src/lib/slug.test.ts): the two copies must agree, and the API is the authority.
const SHARED_CASES: [string, string][] = [
  ['  Our Café & Story!  ', 'our-cafe-story'],
  ['Ünïcode  ÄÖ -- weird___slug/../x', 'unicode-ao-weird-slug-x'],
  ['!!!', ''],
  ['a'.repeat(85), 'a'.repeat(80)],
  [`${'a'.repeat(79)} bcd`, 'a'.repeat(79)],
];

describe('normaliseSlug (CNT-04)', () => {
  it.each(SHARED_CASES)('turns %j into %j', (input, expected) => {
    expect(normaliseSlug(input)).toBe(expected);
  });

  it('lowercases, drops accents and joins words with single hyphens', () => {
    expect(normaliseSlug('  Our Café & Story!  ')).toBe('our-cafe-story');
    expect(normaliseSlug('a---b__c')).toBe('a-b-c');
  });

  it('returns nothing usable as an empty string', () => {
    expect(normaliseSlug('!!!')).toBe('');
  });

  it('caps the length without leaving a trailing hyphen', () => {
    const slug = normaliseSlug(`${'a'.repeat(SLUG_MAX - 1)} bcd`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('slugProblem (CNT-04)', () => {
  it('refuses empty and reserved slugs for a page', () => {
    expect(slugProblem('', true)).not.toBeNull();
    expect(slugProblem('admin', true)).not.toBeNull();
    // the archive addresses (TAX-02)
    expect(slugProblem('category', true)).not.toBeNull();
    expect(slugProblem('tag', true)).not.toBeNull();
    expect(slugProblem('about', true)).toBeNull();
  });

  it('lets an entry use a reserved word, since it sits under its type’s prefix', () => {
    expect(slugProblem('admin', false)).toBeNull();
  });
});
