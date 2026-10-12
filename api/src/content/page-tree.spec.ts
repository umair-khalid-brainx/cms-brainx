import { depthUnder, MAX_DEPTH, planMove, type TreePage } from './page-tree.js';

// home
// about ── team ── leads
//       └─ history
// shop
const pages: TreePage[] = [
  { id: 'home', parentId: null, slug: 'home', path: '/', status: 'published' },
  { id: 'about', parentId: null, slug: 'about', path: '/about', status: 'published' },
  { id: 'team', parentId: 'about', slug: 'team', path: '/about/team', status: 'published' },
  { id: 'leads', parentId: 'team', slug: 'leads', path: '/about/team/leads', status: 'draft' },
  { id: 'history', parentId: 'about', slug: 'history', path: '/about/history', status: 'published' },
  { id: 'shop', parentId: null, slug: 'shop', path: '/shop', status: 'draft' },
];

const fail = (plan: ReturnType<typeof planMove>) => (plan.ok ? null : plan.problem);

describe('planMove: recursive path recomputation (CNT-06, invariant 9)', () => {
  it('renaming a parent moves every page below it, grandchildren included', () => {
    const plan = planMove(pages, 'about', 'company', null);
    expect(plan.ok && plan.path).toBe('/company');
    expect(plan.ok && plan.moves.map((m) => [m.oldPath, m.newPath])).toEqual([
      ['/about', '/company'],
      ['/about/team', '/company/team'],
      ['/about/team/leads', '/company/team/leads'],
      ['/about/history', '/company/history'],
    ]);
    // about, team and history are live; leads is a draft that never went live.
    expect(plan.ok && plan.moves.map((m) => m.everPublished)).toEqual([true, true, false, true]);
  });

  it('moving a subtree under another parent rebuilds its paths there', () => {
    const plan = planMove(pages, 'team', 'team', 'shop');
    expect(plan.ok && plan.moves.map((m) => m.newPath)).toEqual(['/shop/team', '/shop/team/leads']);
  });

  it('moving a child to the top level', () => {
    const plan = planMove(pages, 'history', 'history', null);
    expect(plan.ok && plan.moves).toEqual([
      { id: 'history', oldPath: '/about/history', newPath: '/history', status: 'published', everPublished: true },
    ]);
  });

  it('touches nothing outside the subtree: siblings and other pages are not in the plan', () => {
    const plan = planMove(pages, 'team', 'people', 'about');
    expect(plan.ok && plan.moves.map((m) => m.id)).toEqual(['team', 'leads']);
  });

  it('rebuilds from the parent links, so a stale stored path is corrected', () => {
    const stale = pages.map((p) => (p.id === 'leads' ? { ...p, path: '/old/leads' } : p));
    const plan = planMove(stale, 'about', 'about', null);
    expect(plan.ok && plan.moves).toEqual([
      { id: 'leads', oldPath: '/old/leads', newPath: '/about/team/leads', status: 'draft', everPublished: false },
    ]);
  });
});

describe('planMove: what is refused (CNT-05)', () => {
  it('a page under itself, or under one of its own descendants, at any depth', () => {
    expect(fail(planMove(pages, 'about', 'about', 'about'))).toMatch(/under itself/);
    expect(fail(planMove(pages, 'about', 'about', 'leads'))).toMatch(/under itself/);
  });

  it(`nesting deeper than ${MAX_DEPTH} levels, counting the moving page's own children`, () => {
    // shop is top level; team has a child, so team under history (depth 2) would put leads at 4.
    expect(fail(planMove(pages, 'team', 'team', 'history'))).toMatch(/at most 3/);
    expect(fail(planMove(pages, 'shop', 'shop', 'leads'))).toMatch(/at most 3/);
    expect(planMove(pages, 'shop', 'shop', 'team').ok).toBe(true);
  });

  it('a parent that is not a page of this site, or is the home page', () => {
    expect(fail(planMove(pages, 'shop', 'shop', 'another-sites-page'))).toMatch(/doesn’t exist/);
    expect(fail(planMove(pages, 'shop', 'shop', 'home'))).toMatch(/home page/);
  });

  it('an address another page already has', () => {
    const withClash = [...pages, { id: 'x', parentId: null, slug: 'company-team', path: '/shop/team', status: 'draft' }];
    expect(fail(planMove(withClash, 'team', 'team', 'shop'))).toMatch(/\/shop\/team/);
  });
});

describe('depthUnder', () => {
  it('counts the new page itself', () => {
    expect(depthUnder(pages, 'about')).toBe(2);
    expect(depthUnder(pages, 'team')).toBe(3);
    expect(depthUnder(pages, 'leads')).toBe(4);
  });
});
