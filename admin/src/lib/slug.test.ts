import { describe, expect, it } from 'vitest';
import { normaliseSlug, parentPath } from './slug';

// The same cases as the other side's normaliser test (api/src/content/slug.spec.ts and
// admin/src/lib/slug.test.ts): the two copies must agree, and the API is the authority.
const SHARED_CASES: [string, string][] = [
  ['  Our Café & Story!  ', 'our-cafe-story'],
  ['Ünïcode  ÄÖ -- weird___slug/../x', 'unicode-ao-weird-slug-x'],
  ['!!!', ''],
  ['a'.repeat(85), 'a'.repeat(80)],
  [`${'a'.repeat(79)} bcd`, 'a'.repeat(79)],
];

describe('normaliseSlug', () => {
  it.each(SHARED_CASES)('turns %j into %j', (input, expected) => {
    expect(normaliseSlug(input)).toBe(expected);
  });

  it('matches the API: lowercase, no accents, single hyphens', () => {
    expect(normaliseSlug('  Our Café & Story!  ')).toBe('our-cafe-story');
    expect(normaliseSlug('!!!')).toBe('');
  });
});

describe('parentPath', () => {
  it('keeps everything before the last part', () => {
    expect(parentPath('/events/fair')).toBe('/events');
    expect(parentPath('/about')).toBe('');
  });
});
