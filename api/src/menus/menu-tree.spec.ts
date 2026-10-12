import { menuSchema, pageIdsOf, publicMenu, storedPageIds, type PageFacts, type StoredItem } from './menu-tree.js';

const parse = (input: unknown) => menuSchema.safeParse(input);
const problems = (input: unknown) => {
  const result = parse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('menuSchema (GOV-03)', () => {
  it('takes pages and links, with children, trimmed', () => {
    const result = parse({
      items: [
        { label: ' About ', contentId: 'p1', children: [{ label: 'Team', contentId: 'p2' }, { label: 'Map', url: '/find-us' }] },
        { label: 'Shop', url: 'https://shop.example.com/' },
        { label: 'Email', url: 'mailto:hi@example.com' },
        { label: 'Call', url: 'tel:+15551234567' },
        { label: 'Contact', url: '#contact' },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.items[0]).toMatchObject({ label: 'About', contentId: 'p1', children: [{ label: 'Team' }, { label: 'Map' }] });
  });

  it('accepts an empty menu (to clear it)', () => {
    expect(parse({ items: [] }).success).toBe(true);
  });

  it('refuses an item that is both a page and a link, or neither, naming it', () => {
    expect(problems({ items: [{ label: 'Both', contentId: 'p1', url: '/x' }] })).toEqual(['“Both” must be either a page or a link, not both and not neither.']);
    expect(problems({ items: [{ label: 'Neither' }] })).toEqual(['“Neither” must be either a page or a link, not both and not neither.']);
    expect(problems({ items: [{ label: 'Blank link', url: '  ' }] })).toHaveLength(1);
  });

  it('refuses links that could run a script or leave the site’s own addresses', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', '//evil.com', 'ftp://x.com/a', '/a b', 'about', 'https://', '#', '/a\\b', 'mailto:']) {
      expect(parse({ items: [{ label: 'X', url }] }).success, url).toBe(false);
    }
  });

  it('refuses a missing or over-long label, and too many items', () => {
    expect(problems({ items: [{ label: '  ', url: '/x' }] })).toEqual(['Every menu item needs a label.']);
    expect(problems({ items: [{ label: 'x'.repeat(81), url: '/x' }] })).toEqual(['A label can be at most 80 characters.']);
    expect(problems({ items: Array.from({ length: 21 }, (_, i) => ({ label: `i${i}`, url: '/x' })) })).toEqual([
      'A menu can have at most 20 top-level items.',
    ]);
    expect(problems({ items: [{ label: 'P', url: '/x', children: Array.from({ length: 21 }, (_, i) => ({ label: `c${i}`, url: '/y' })) }] })).toEqual([
      'A menu item can have at most 20 items under it.',
    ]);
  });

  it('is two levels deep at most: a child’s own children are dropped, never kept', () => {
    const result = parse({ items: [{ label: 'A', url: '/a', children: [{ label: 'B', url: '/b', children: [{ label: 'C', url: '/c' }] }] }] });
    expect(result.success && result.data.items[0].children[0]).toEqual({ label: 'B', url: '/b' });
  });
});

describe('pageIdsOf', () => {
  it('lists each page once, from any level', () => {
    const menu = menuSchema.parse({
      items: [{ label: 'A', contentId: 'p1', children: [{ label: 'B', contentId: 'p2' }, { label: 'C', contentId: 'p1' }] }, { label: 'D', url: '/d' }],
    });
    expect(pageIdsOf(menu).sort()).toEqual(['p1', 'p2']);
  });
});

describe('storedPageIds', () => {
  it('lists each page once, across menus and levels, and none for links', () => {
    const header: StoredItem[] = [
      { label: 'A', contentId: 'p1', url: null, children: [{ label: 'B', contentId: 'p2', url: null }, { label: 'C', contentId: null, url: '/c' }] },
    ];
    const footer: StoredItem[] = [{ label: 'D', contentId: 'p1', url: null }, { label: 'E', contentId: null, url: '/e' }];
    expect(storedPageIds(header, footer).sort()).toEqual(['p1', 'p2']);
    expect(storedPageIds([], [])).toEqual([]);
  });
});

describe('publicMenu: what a visitor sees', () => {
  const pages = new Map<string, PageFacts>([
    ['live', { path: '/about', status: 'published' }],
    ['kid', { path: '/about/team', status: 'published' }],
    ['draft', { path: '/draft', status: 'draft' }],
    ['gone', { path: '/old', status: 'archived' }],
  ]);
  const item = (label: string, target: { contentId?: string; url?: string }, children: StoredItem[] = []): StoredItem => ({
    label,
    contentId: target.contentId ?? null,
    url: target.url ?? null,
    children,
  });

  it('points a page item at the page’s current address, so it follows a rename or a move', () => {
    expect(publicMenu([item('About', { contentId: 'live' }, [item('Team', { contentId: 'kid' })])], pages)).toEqual([
      { label: 'About', href: '/about', children: [{ label: 'Team', href: '/about/team' }] },
    ]);
    const moved = new Map(pages).set('live', { path: '/company', status: 'published' });
    expect(publicMenu([item('About', { contentId: 'live' })], moved)[0].href).toBe('/company');
  });

  it('hides an item whose page is a draft, archived, or no longer exists', () => {
    const shown = publicMenu([item('Draft', { contentId: 'draft' }), item('Gone', { contentId: 'gone' }), item('Missing', { contentId: 'nope' }), item('Shop', { url: '/shop' })], pages);
    expect(shown.map((entry) => entry.label)).toEqual(['Shop']);
  });

  it('hides a child whose page is hidden, keeping its siblings', () => {
    const shown = publicMenu([item('About', { contentId: 'live' }, [item('Team', { contentId: 'kid' }), item('Draft', { contentId: 'draft' })])], pages);
    expect(shown[0].children.map((child) => child.label)).toEqual(['Team']);
  });

  it('keeps a top item whose own page is hidden as a heading when items under it are shown, so they aren’t lost', () => {
    const shown = publicMenu([item('Company', { contentId: 'draft' }, [item('Team', { contentId: 'kid' })])], pages);
    expect(shown).toEqual([{ label: 'Company', href: null, children: [{ label: 'Team', href: '/about/team' }] }]);
  });

  it('drops a hidden top item with nothing shown under it', () => {
    expect(publicMenu([item('Company', { contentId: 'draft' }, [item('Gone', { contentId: 'gone' })])], pages)).toEqual([]);
  });

  it('keeps links as they are, including on an item with no children', () => {
    expect(publicMenu([item('Mail', { url: 'mailto:a@b.co' })], pages)).toEqual([{ label: 'Mail', href: 'mailto:a@b.co', children: [] }]);
  });
});
