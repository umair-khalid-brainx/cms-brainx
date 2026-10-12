import { checkCategoryIds, MAX_TAGS_PER_ENTRY, optInProblem, parseTagNames, parseTermName, tidyTermName } from './term-rules.js';

describe('parseTermName (TAX-01)', () => {
  it('trims, collapses spaces and derives the slug', () => {
    expect(parseTermName('  Product   News ', 'category')).toEqual({ ok: true, term: { name: 'Product News', slug: 'product-news' } });
  });

  it('removes accents from the slug but keeps them in the name', () => {
    expect(parseTermName('Café', 'tag')).toEqual({ ok: true, term: { name: 'Café', slug: 'cafe' } });
  });

  it('accepts 60 characters and refuses 61', () => {
    expect(parseTermName('a'.repeat(60), 'tag').ok).toBe(true);
    expect(parseTermName('a'.repeat(61), 'tag')).toMatchObject({ ok: false });
  });

  it.each(['', '   ', '+++', '!!', 5, null, undefined])('refuses %j', (value) => {
    expect(parseTermName(value, 'category').ok).toBe(false);
  });

  it('names the kind in its message', () => {
    expect(parseTermName('', 'tag')).toEqual({ ok: false, problem: 'Enter a name for the tag.' });
  });

  it('drops NUL and line breaks', () => {
    expect(tidyTermName('a\u0000b\nc')).toBe('ab c');
  });
});

describe('parseTagNames', () => {
  it('drops repeats whatever their case, keeping the first spelling', () => {
    expect(parseTagNames(['News', 'news', ' NEWS ', 'Launch'])).toEqual({
      ok: true,
      tags: [
        { name: 'News', slug: 'news' },
        { name: 'Launch', slug: 'launch' },
      ],
    });
  });

  it(`allows ${MAX_TAGS_PER_ENTRY} and refuses one more`, () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => `tag ${i}`);
    expect(parseTagNames(names(MAX_TAGS_PER_ENTRY)).ok).toBe(true);
    expect(parseTagNames(names(MAX_TAGS_PER_ENTRY + 1)).ok).toBe(false);
  });

  it('counts after repeats are dropped', () => {
    const names = Array.from({ length: 30 }, () => 'same');
    expect(parseTagNames(names)).toEqual({ ok: true, tags: [{ name: 'same', slug: 'same' }] });
  });

  it('reports each kind of problem once', () => {
    expect(parseTagNames(['', ' ', 'ok'])).toEqual({ ok: false, problems: ['Enter a name for the tag.'] });
  });
});

describe('optInProblem', () => {
  const posts = { name: 'Posts', hasCategories: true, hasTags: false };

  it('lets a type use what it opted into', () => {
    expect(optInProblem(posts, { category: true, tag: false })).toBeNull();
    expect(optInProblem(posts, { category: false, tag: false })).toBeNull();
  });

  it('refuses a kind the type has not opted into', () => {
    expect(optInProblem(posts, { category: false, tag: true })).toContain('doesn’t use tags');
    expect(optInProblem({ ...posts, hasCategories: false }, { category: true, tag: false })).toContain('doesn’t use categories');
  });

  it('refuses both on a page', () => {
    expect(optInProblem(null, { category: true, tag: false })).toContain('Only entries');
    expect(optInProblem(null, { category: false, tag: true })).toContain('Only entries');
    expect(optInProblem(null, { category: false, tag: false })).toBeNull();
  });
});

describe('checkCategoryIds', () => {
  const found = [
    { id: 'c1', kind: 'category' as const },
    { id: 't1', kind: 'tag' as const },
  ];

  it('accepts known categories and drops repeats', () => {
    expect(checkCategoryIds(['c1', 'c1'], found)).toEqual({ ok: true, ids: ['c1'] });
  });

  it('refuses an id the site does not have, or one that is a tag', () => {
    expect(checkCategoryIds(['c1', 'other-site'], found).ok).toBe(false);
    expect(checkCategoryIds(['t1'], found).ok).toBe(false);
  });

  it('accepts none', () => {
    expect(checkCategoryIds([], found)).toEqual({ ok: true, ids: [] });
  });
});
