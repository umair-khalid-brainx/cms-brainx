import { describe, expect, it } from 'vitest';
import { hasLiveBelow, orderAsTree, parentChoices } from './pageTree';

// home · shop · about ─ team ─ leads
const pages = [
  { id: 'home', parentId: null, path: '/' },
  { id: 'leads', parentId: 'team', path: '/about/team/leads' },
  { id: 'shop', parentId: null, path: '/shop' },
  { id: 'team', parentId: 'about', path: '/about/team' },
  { id: 'about', parentId: null, path: '/about' },
];

describe('orderAsTree', () => {
  it('puts each child right under its parent, with its depth', () => {
    expect(orderAsTree(pages).map(({ page, depth }) => `${depth}:${page.id}`)).toEqual(['1:home', '1:shop', '1:about', '2:team', '3:leads']);
  });

  it('shows a page whose parent is missing (archived) at the top', () => {
    expect(orderAsTree(pages.filter((p) => p.id !== 'about')).map(({ page, depth }) => `${depth}:${page.id}`)).toEqual([
      '1:home',
      '1:shop',
      '1:team',
      '2:leads',
    ]);
  });
});

describe('parentChoices', () => {
  const reasons = (pageId: string) =>
    Object.fromEntries(parentChoices(pages, pageId).map(({ page, disabledReason }) => [page.id, disabledReason]));

  it('rules out the home page, the page itself and anything inside it', () => {
    // about already holds two levels (team, leads), so even top-level shop would make four.
    expect(reasons('about')).toEqual({
      home: 'the home page',
      shop: 'too deep',
      about: 'this page',
      team: 'inside this page',
      leads: 'inside this page',
    });
  });

  it('rules out parents that would push the page or its children past 3 levels', () => {
    // team has a child, so it needs a top-level parent.
    expect(reasons('team')).toMatchObject({ shop: null, about: null, leads: 'inside this page' });
    expect(reasons('shop')).toMatchObject({ about: null, team: null, leads: 'too deep' });
  });
});

describe('hasLiveBelow', () => {
  const withStatus = pages.map((p) => ({ ...p, status: p.id === 'leads' ? 'published' : 'draft' }));

  it('finds a live page anywhere below, but not the page itself or beside it', () => {
    expect(hasLiveBelow(withStatus, 'about')).toBe(true);
    expect(hasLiveBelow(withStatus, 'team')).toBe(true);
    expect(hasLiveBelow(withStatus, 'leads')).toBe(false);
    expect(hasLiveBelow(withStatus, 'shop')).toBe(false);
  });
});
