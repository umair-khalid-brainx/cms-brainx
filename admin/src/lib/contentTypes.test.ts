import { describe, expect, it } from 'vitest';
import { singularize, suggestPrefix } from './contentTypes';

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

  it('stays within the limit without a trailing hyphen', () => {
    const suggestion = suggestPrefix(`${'word '.repeat(20)}end`);
    expect(suggestion.length).toBeLessThanOrEqual(40);
    expect(suggestion.endsWith('-')).toBe(false);
  });
});

describe('singularize', () => {
  it.each([
    ['Events', 'Event'],
    ['Posts', 'Post'],
    ['Case studies', 'Case study'],
    ['Stories', 'Story'],
    ['Boxes', 'Box'],
    ['Branches', 'Branch'],
    ['Business', 'Business'],
    ['Status', 'Status'],
    ['News', 'New'],
    ['Team', 'Team'],
    ['Staff', 'Staff'],
    ['', ''],
  ])('%j becomes %j', (plural, expected) => {
    expect(singularize(plural)).toBe(expected);
  });
});
