import { describe, expect, it } from 'vitest';
import {
  MAX_TAGS_PER_ENTRY,
  addTag,
  addTags,
  entriesLabel,
  nameProblem,
  removeLastTag,
  removeTag,
  sameIds,
  sameTags,
  tagSuggestions,
  termKey,
  tidyTermName,
} from './terms';

describe('term names (mirrors the API)', () => {
  it('tidies spaces', () => {
    expect(tidyTermName('  Product   News ')).toBe('Product News');
  });

  it('keys are case- and accent-insensitive', () => {
    expect(termKey('Café')).toBe(termKey(' cafe '));
  });

  it('accepts 60 characters, refuses 61, blank and symbols only', () => {
    expect(nameProblem('a'.repeat(60), 'tag')).toBeNull();
    expect(nameProblem('a'.repeat(61), 'tag')).toContain('60');
    expect(nameProblem('  ', 'category')).toBe('Enter a name for the category.');
    expect(nameProblem('+++', 'tag')).toContain('letter or number');
  });
});

describe('addTag', () => {
  it('adds a tidy name', () => {
    expect(addTag(['one'], '  two  ')).toEqual({ tags: ['one', 'two'], added: true });
  });

  it('does not add a repeat in another case, and says so', () => {
    const result = addTag(['News'], 'news');
    expect(result.added).toBe(false);
    expect(result.tags).toEqual(['News']);
    expect(result.problem).toContain('already added');
  });

  it(`stops at ${MAX_TAGS_PER_ENTRY}`, () => {
    const full = Array.from({ length: MAX_TAGS_PER_ENTRY }, (_, i) => `t${i}`);
    expect(addTag(full, 'one more')).toMatchObject({ added: false, problem: expect.stringContaining('20') });
    expect(addTag(full.slice(1), 'one more').added).toBe(true);
  });

  it('refuses a blank name without changing anything', () => {
    expect(addTag(['a'], ' ')).toMatchObject({ tags: ['a'], added: false });
  });
});

describe('addTags', () => {
  it('splits on commas, skipping empty pieces and repeats', () => {
    expect(addTags(['a'], 'b, c,, A, b').tags).toEqual(['a', 'b', 'c']);
  });

  it('reports the first problem but keeps what could be added', () => {
    const result = addTags([], 'ok, +++, fine');
    expect(result.tags).toEqual(['ok', 'fine']);
    expect(result.problem).toContain('letter or number');
  });
});

describe('removing', () => {
  it('removes by name, ignoring case', () => {
    expect(removeTag(['News', 'Launch'], 'news')).toEqual(['Launch']);
  });

  it('removes the last, and nothing from an empty list', () => {
    expect(removeLastTag(['a', 'b'])).toEqual(['a']);
    expect(removeLastTag([])).toEqual([]);
  });
});

describe('tagSuggestions', () => {
  const all = ['News', 'Newsletter', 'Launch', 'Renewals'];

  it('matches anywhere, any case, and leaves out chosen tags', () => {
    expect(tagSuggestions(all, ['newsletter'], 'NEW')).toEqual(['News', 'Renewals']);
  });

  it('suggests nothing for an empty query, and respects the limit', () => {
    expect(tagSuggestions(all, [], '  ')).toEqual([]);
    expect(tagSuggestions(all, [], 'e', 2)).toHaveLength(2);
  });
});

describe('comparisons', () => {
  it('sameTags ignores order and case', () => {
    expect(sameTags(['A', 'b'], ['B', 'a'])).toBe(true);
    expect(sameTags(['a'], ['a', 'b'])).toBe(false);
  });

  it('sameIds ignores order', () => {
    expect(sameIds(['1', '2'], ['2', '1'])).toBe(true);
    expect(sameIds(['1'], ['2'])).toBe(false);
  });

  it('entriesLabel pluralises', () => {
    expect(entriesLabel(1)).toBe('1 entry');
    expect(entriesLabel(0)).toBe('0 entries');
    expect(entriesLabel(5)).toBe('5 entries');
  });
});
