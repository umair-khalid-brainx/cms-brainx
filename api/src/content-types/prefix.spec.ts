import { prefixProblem, suggestPrefix } from './prefix.js';

describe('prefixProblem', () => {
  it.each(['events', 'case-studies', 'team', 'a1', 'news-2026', 'ab', 'a'.repeat(40)])('accepts %s', (prefix) => {
    expect(prefixProblem(prefix)).toBeNull();
  });

  it.each([
    ['', 'too short'],
    ['a', 'too short'],
    ['a'.repeat(41), 'too long'],
    ['Events', 'uppercase'],
    ['my events', 'a space'],
    ['events/2026', 'a slash'],
    ['/events', 'a leading slash'],
    ['events.html', 'a dot'],
    ['-events', 'a leading hyphen'],
    ['events-', 'a trailing hyphen'],
    ['ev--ents', 'a double hyphen'],
    ['événements', 'an accent'],
    ['..', 'dots only'],
    ['ev_ents', 'an underscore'],
  ])('refuses %j (%s)', (prefix) => {
    expect(prefixProblem(prefix)).not.toBeNull();
  });

  it.each(['admin', 'api', 'preview', 'internal', 'uploads', 'category', 'tag', 'sitemap', 'robots', 'home'])(
    'refuses the reserved address %s, and says why',
    (prefix) => {
      expect(prefixProblem(prefix)).toContain('used by the site itself');
    },
  );
});

describe('suggestPrefix', () => {
  it.each([
    ['Events', 'events'],
    ['Case Studies', 'case-studies'],
    ['  Our   Team! ', 'our-team'],
    ['Événements', 'evenements'],
    ['News & Press', 'news-press'],
    ['', ''],
    ['!!!', ''],
  ])('%j becomes %j', (name, expected) => {
    expect(suggestPrefix(name)).toBe(expected);
  });

  it('keeps a long name within the limit without a trailing hyphen', () => {
    const suggestion = suggestPrefix(`${'word '.repeat(20)}end`);
    expect(suggestion.length).toBeLessThanOrEqual(40);
    expect(suggestion.endsWith('-')).toBe(false);
  });
});
