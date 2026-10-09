import { describe, expect, it } from 'vitest';
import { normaliseHref } from './richTextLink';

describe('normaliseHref', () => {
  it.each([
    ['https://example.com/a', 'https://example.com/a'],
    ['http://example.com', 'http://example.com'],
    ['mailto:hello@example.com', 'mailto:hello@example.com'],
    ['/about', '/about'],
    ['#pricing', '#pricing'],
    ['  https://example.com  ', 'https://example.com'],
  ])('keeps %s', (input, expected) => {
    expect(normaliseHref(input)).toBe(expected);
  });

  it('adds https to a bare domain', () => {
    expect(normaliseHref('example.com/about')).toBe('https://example.com/about');
  });

  it.each(['', '   ', '//evil.com', '/\\evil.com', 'https://', 'http://', 'mailto:', '#', 'https://a.com\\b', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,hi', 'not a link', 'ftp://example.com'])(
    'refuses %j',
    (input) => {
      expect(normaliseHref(input)).toBeNull();
    },
  );
});
