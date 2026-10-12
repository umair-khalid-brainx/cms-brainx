import { describe, expect, it } from 'vitest';
import {
  CHILDREN_MAX,
  TOP_ITEMS_MAX,
  add,
  canDrop,
  canIndent,
  canMoveDown,
  canMoveUp,
  canOutdent,
  countItems,
  fromServer,
  indent,
  indentProblem,
  linkItem,
  linkProblem,
  moveDown,
  moveTo,
  moveUp,
  outdent,
  remove,
  rename,
  sameMenu,
  toPayload,
  type Menu,
  type MenuNode,
} from './menuEditor';

const item = (label: string, children: MenuNode[] = []): MenuNode => ({ ...linkItem(label, `/${label.toLowerCase()}`), key: label, children });
/** A, B (with B1, B2), C, D */
const menu = (): Menu => [item('A'), item('B', [item('B1'), item('B2')]), item('C'), item('D')];
const labels = (m: Menu) => m.map((n) => (n.children.length ? `${n.label}[${n.children.map((c) => c.label).join(',')}]` : n.label));

describe('moving up and down', () => {
  it('swaps with the neighbour on the same level', () => {
    expect(labels(moveUp(menu(), 'C'))).toEqual(['A', 'C', 'B[B1,B2]', 'D']);
    expect(labels(moveDown(menu(), 'A'))).toEqual(['B[B1,B2]', 'A', 'C', 'D']);
    expect(labels(moveUp(menu(), 'B2'))).toEqual(['A', 'B[B2,B1]', 'C', 'D']);
    expect(labels(moveDown(menu(), 'B1'))).toEqual(['A', 'B[B2,B1]', 'C', 'D']);
  });

  it('does nothing at the ends, and says so', () => {
    expect(canMoveUp(menu(), 'A')).toBe(false);
    expect(canMoveDown(menu(), 'D')).toBe(false);
    expect(canMoveUp(menu(), 'B1')).toBe(false);
    expect(canMoveDown(menu(), 'B2')).toBe(false);
    expect(moveUp(menu(), 'A')).toEqual(menu());
  });
});

describe('nesting and un-nesting', () => {
  it('indent puts an item under the one above it, as its last child', () => {
    expect(labels(indent(menu(), 'C'))).toEqual(['A', 'B[B1,B2,C]', 'D']);
    expect(labels(indent(menu(), 'D'))).toEqual(['A', 'B[B1,B2]', 'C[D]']);
  });

  it('indent is not offered for the first item, an item with its own items (two levels at most), or an item already under another', () => {
    expect(canIndent(menu(), 'A')).toBe(false);
    expect(indentProblem(menu(), 'A')).toMatch(/Nothing above/);
    const withKids = [item('A'), item('B', [item('B1')])];
    expect(canIndent(withKids, 'B')).toBe(false);
    expect(indentProblem(withKids, 'B')).toMatch(/two levels/);
    expect(canIndent(menu(), 'B1')).toBe(false);
    expect(indent(menu(), 'B')).toEqual(menu());
  });

  it('indent is refused when the item above already has the most items under it', () => {
    const full = [item('A', Array.from({ length: CHILDREN_MAX }, (_, i) => item(`k${i}`))), item('B')];
    expect(canIndent(full, 'B')).toBe(false);
    expect(indentProblem(full, 'B')).toMatch(/already has/);
  });

  it('outdent takes an item out to the top level, right after the item it was under', () => {
    expect(labels(outdent(menu(), 'B1'))).toEqual(['A', 'B[B2]', 'B1', 'C', 'D']);
    expect(labels(outdent(menu(), 'B2'))).toEqual(['A', 'B[B1]', 'B2', 'C', 'D']);
    expect(canOutdent(menu(), 'A')).toBe(false);
    expect(outdent(menu(), 'A')).toEqual(menu());
  });

  it('outdent is refused when the top level is full', () => {
    const full = [item('P', [item('c')]), ...Array.from({ length: TOP_ITEMS_MAX - 1 }, (_, i) => item(`t${i}`))];
    expect(canOutdent(full, 'c')).toBe(false);
  });
});

describe('adding, renaming and removing', () => {
  it('adds to the end of the top level, up to the limit', () => {
    expect(labels(add(menu(), item('E')))).toEqual(['A', 'B[B1,B2]', 'C', 'D', 'E']);
    const full = Array.from({ length: TOP_ITEMS_MAX }, (_, i) => item(`t${i}`));
    expect(add(full, item('extra'))).toHaveLength(TOP_ITEMS_MAX);
  });

  it('renames one item and leaves every other label alone', () => {
    expect(labels(rename(menu(), 'B1', 'First'))).toEqual(['A', 'B[First,B2]', 'C', 'D']);
    expect(labels(rename(menu(), 'C', 'Third'))).toEqual(['A', 'B[B1,B2]', 'Third', 'D']);
  });

  it('removes an item at any level; removing a top item takes the items under it too', () => {
    expect(labels(remove(menu(), 'B2'))).toEqual(['A', 'B[B1]', 'C', 'D']);
    expect(labels(remove(menu(), 'B'))).toEqual(['A', 'C', 'D']);
  });
});

describe('drag and drop', () => {
  it('before and after an item put the dragged one next to it', () => {
    expect(labels(moveTo(menu(), 'D', 'A', 'before'))).toEqual(['D', 'A', 'B[B1,B2]', 'C']);
    expect(labels(moveTo(menu(), 'A', 'C', 'after'))).toEqual(['B[B1,B2]', 'C', 'A', 'D']);
  });

  it('inside makes it the last item under the target', () => {
    expect(labels(moveTo(menu(), 'D', 'A', 'inside'))).toEqual(['A[D]', 'B[B1,B2]', 'C']);
    expect(labels(moveTo(menu(), 'A', 'B', 'inside'))).toEqual(['B[B1,B2,A]', 'C', 'D']);
  });

  it('a child dropped before or after a top item becomes a top item, and the other way round', () => {
    expect(labels(moveTo(menu(), 'B1', 'D', 'after'))).toEqual(['A', 'B[B2]', 'C', 'D', 'B1']);
    expect(labels(moveTo(menu(), 'C', 'B1', 'before'))).toEqual(['A', 'B[C,B1,B2]', 'D']);
    expect(labels(moveTo(menu(), 'B2', 'B1', 'before'))).toEqual(['A', 'B[B2,B1]', 'C', 'D']);
  });

  it('refuses what would break the two-level rule or go nowhere, and changes nothing', () => {
    expect(canDrop(menu(), 'A', 'A', 'after')).toBe(false);
    // B has items of its own: it can't go inside another item, or among another item's children.
    expect(canDrop(menu(), 'B', 'A', 'inside')).toBe(false);
    expect(canDrop(menu(), 'B', 'C', 'inside')).toBe(false);
    // Inside a child isn't possible: children have no children.
    expect(canDrop(menu(), 'A', 'B1', 'inside')).toBe(false);
    expect(moveTo(menu(), 'B', 'A', 'inside')).toEqual(menu());
    expect(moveTo(menu(), 'nope', 'A', 'before')).toEqual(menu());
  });

  it('a top item with items of its own can still move next to other top items', () => {
    expect(labels(moveTo(menu(), 'B', 'D', 'after'))).toEqual(['A', 'C', 'D', 'B[B1,B2]']);
  });

  it('respects the limits: a full parent takes no more inside, a full top level takes no more outside', () => {
    const fullParent = [item('A', Array.from({ length: CHILDREN_MAX }, (_, i) => item(`k${i}`))), item('B')];
    expect(canDrop(fullParent, 'B', 'A', 'inside')).toBe(false);
    const fullTop = [item('P', [item('c')]), ...Array.from({ length: TOP_ITEMS_MAX - 1 }, (_, i) => item(`t${i}`))];
    expect(canDrop(fullTop, 'c', 't0', 'before')).toBe(false);
    expect(canDrop(fullTop, 't0', 't1', 'before')).toBe(true);
  });
});

describe('saving', () => {
  it('sends labels and targets, a page by its id and a link by its address, without the editor’s own keys', () => {
    const m: Menu = [
      { key: 'x', label: ' About ', contentId: 'p1', url: null, page: { title: 'About', path: '/about', status: 'published' }, children: [{ ...linkItem(' Map ', ' /find-us '), key: 'y' }] },
    ];
    expect(toPayload(m)).toEqual({ items: [{ label: 'About', contentId: 'p1', children: [{ label: 'Map', url: '/find-us' }] }] });
  });

  it('knows whether anything changed, ignoring keys', () => {
    const server = [{ label: 'About', contentId: 'p1', url: null, page: null, children: [{ label: 'Map', contentId: null, url: '/find-us', page: null }] }];
    const a = fromServer(server);
    const b = fromServer(server);
    expect(sameMenu(a, b)).toBe(true);
    expect(sameMenu(a, rename(b, b[0].key, 'About us'))).toBe(false);
    expect(sameMenu(a, moveDown(add(b, linkItem('x', '/x')), b[0].key))).toBe(false);
  });

  it('counts every item, those under others too', () => {
    expect(countItems(menu())).toBe(6);
    expect(countItems([])).toBe(0);
  });
});

describe('linkProblem', () => {
  it('accepts paths, anchors, web addresses, email and phone links', () => {
    for (const ok of ['/about', ' /find-us#map ', '#contact', 'https://example.com/shop', 'http://example.com', 'mailto:hi@example.com', 'tel:+15551234567']) {
      expect(linkProblem(ok), ok).toBeNull();
    }
  });

  it('refuses the rest with a reason', () => {
    expect(linkProblem('')).toMatch(/Enter where/);
    for (const bad of ['javascript:alert(1)', '//evil.com', 'about', '/a b', 'https://', '#', 'ftp://x.com/a', 'mailto:']) {
      expect(linkProblem(bad), bad).not.toBeNull();
    }
  });
});

