// The menu being edited (GOV-03), as a tree of two levels at most, and every change the editor
// can make to it. Pure and immutable: each function returns a new tree (or the same one when the
// change isn't allowed), so the rules are tested without a screen. The API checks everything again
// (api/src/menus/menu-tree.ts); this keeps the editor from offering what the API would refuse.

/** The API's limits (the repos can't share code, so keep these in step). */
export const TOP_ITEMS_MAX = 20;
export const CHILDREN_MAX = 20;
export const LABEL_MAX = 80;

export type PageFacts = { title: string; path: string; status: string };

export type MenuNode = {
  /** Only for the editor: tells items apart while they are renamed and moved. */
  key: string;
  label: string;
  /** A page item points at a page by id, so it follows the page's address. */
  contentId: string | null;
  /** A custom link. Exactly one of `contentId` and `url` is set. */
  url: string | null;
  /** The page's title, address and status for showing, when it is a page. */
  page: PageFacts | null;
  children: MenuNode[];
};

export type Menu = MenuNode[];

let counter = 0;
/** A key no other item has had in this session. */
export function newKey(): string {
  counter += 1;
  return `item-${counter}`;
}

/** Why a custom link can't be used, in words for the person typing it; null when it is fine. Mirrors the API's rule. */
export function linkProblem(url: string): string | null {
  const value = url.trim();
  if (value === '') return 'Enter where the link goes.';
  if (value.length > 500) return 'A link can be at most 500 characters.';
  if (value.startsWith('/')) return value.startsWith('//') || /[\s\\]/.test(value) ? 'Use a path like /about, or a full web address.' : null;
  if (value.startsWith('#')) return value.length > 1 && !/\s/.test(value) ? null : 'Use an anchor like #contact.';
  if (/^(mailto|tel):\S+$/i.test(value)) return null;
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).hostname ? null : 'Use a full web address like https://example.com.';
    } catch {
      return 'Use a full web address like https://example.com.';
    }
  }
  return 'A link must start with https://, http://, mailto:, tel:, / or #.';
}

export function pageItem(page: PageFacts & { id: string }): MenuNode {
  return { key: newKey(), label: page.title, contentId: page.id, url: null, page: { title: page.title, path: page.path, status: page.status }, children: [] };
}

export function linkItem(label: string, url: string): MenuNode {
  return { key: newKey(), label: label.trim(), contentId: null, url: url.trim(), page: null, children: [] };
}

/** What the API sent for one item and its children, given editor keys. */
type ServerItem = { label: string; contentId: string | null; url: string | null; page: PageFacts | null; children?: ServerItem[] };

export function fromServer(items: readonly ServerItem[]): Menu {
  const node = (item: ServerItem): MenuNode => ({
    key: newKey(),
    label: item.label,
    contentId: item.contentId,
    url: item.url,
    page: item.page,
    children: (item.children ?? []).map(node),
  });
  return items.map(node);
}

/** The body of a save: the tree without the editor's keys and display facts. */
export function toPayload(menu: Menu): { items: unknown[] } {
  const target = (node: MenuNode) => (node.contentId ? { contentId: node.contentId } : { url: node.url ?? '' });
  return {
    items: menu.map((node) => ({
      label: node.label.trim(),
      ...target(node),
      children: node.children.map((child) => ({ label: child.label.trim(), ...target(child) })),
    })),
  };
}

/** The same menu, ignoring keys and display facts: whether there is anything to save. */
export function sameMenu(a: Menu, b: Menu): boolean {
  return JSON.stringify(toPayload(a)) === JSON.stringify(toPayload(b));
}

/** Where an item is: its top-level index, and its index among a parent's children when it is one. */
type Place = { top: number; child: number | null };

export function find(menu: Menu, key: string): Place | null {
  for (const [top, node] of menu.entries()) {
    if (node.key === key) return { top, child: null };
    const child = node.children.findIndex((candidate) => candidate.key === key);
    if (child !== -1) return { top, child };
  }
  return null;
}

export function itemAt(menu: Menu, place: Place): MenuNode {
  const node = menu[place.top];
  return place.child === null ? node : node.children[place.child];
}

const withTop = (menu: Menu, top: number, update: (node: MenuNode) => MenuNode): Menu => menu.map((node, index) => (index === top ? update(node) : node));

function swap<T>(list: readonly T[], a: number, b: number): T[] {
  const copy = [...list];
  [copy[a], copy[b]] = [copy[b], copy[a]];
  return copy;
}

// --- what is allowed, for enabling and disabling the buttons ----------------------------------

export function canMoveUp(menu: Menu, key: string): boolean {
  const place = find(menu, key);
  return place !== null && (place.child === null ? place.top : place.child) > 0;
}

export function canMoveDown(menu: Menu, key: string): boolean {
  const place = find(menu, key);
  if (!place) return false;
  return place.child === null ? place.top < menu.length - 1 : place.child < menu[place.top].children.length - 1;
}

/** A top item with something above it, and no items of its own, can go under the one above (two levels at most). */
export function canIndent(menu: Menu, key: string): boolean {
  const place = find(menu, key);
  if (!place || place.child !== null || place.top === 0) return false;
  return menu[place.top].children.length === 0 && menu[place.top - 1].children.length < CHILDREN_MAX;
}

export function canOutdent(menu: Menu, key: string): boolean {
  const place = find(menu, key);
  return place !== null && place.child !== null && menu.length < TOP_ITEMS_MAX;
}

/** Why an arrow is off, in words, for the button's tooltip. */
export function indentProblem(menu: Menu, key: string): string | null {
  const place = find(menu, key);
  if (!place) return null;
  if (place.child !== null) return 'Already under another item.';
  if (place.top === 0) return 'Nothing above it to go under.';
  if (menu[place.top].children.length > 0) return 'It has items under it. Menus go two levels deep.';
  if (menu[place.top - 1].children.length >= CHILDREN_MAX) return `The item above already has ${CHILDREN_MAX} items under it.`;
  return null;
}

// --- changes ----------------------------------------------------------------------------------

export function add(menu: Menu, node: MenuNode): Menu {
  return menu.length >= TOP_ITEMS_MAX ? menu : [...menu, node];
}

export function remove(menu: Menu, key: string): Menu {
  return menu.filter((node) => node.key !== key).map((node) => ({ ...node, children: node.children.filter((child) => child.key !== key) }));
}

export function rename(menu: Menu, key: string, label: string): Menu {
  return menu.map((node) => ({
    ...node,
    label: node.key === key ? label : node.label,
    children: node.children.map((child) => (child.key === key ? { ...child, label } : child)),
  }));
}

export function moveUp(menu: Menu, key: string): Menu {
  const place = find(menu, key);
  if (!place || !canMoveUp(menu, key)) return menu;
  if (place.child === null) return swap(menu, place.top, place.top - 1);
  return withTop(menu, place.top, (node) => ({ ...node, children: swap(node.children, place.child as number, (place.child as number) - 1) }));
}

export function moveDown(menu: Menu, key: string): Menu {
  const place = find(menu, key);
  if (!place || !canMoveDown(menu, key)) return menu;
  if (place.child === null) return swap(menu, place.top, place.top + 1);
  return withTop(menu, place.top, (node) => ({ ...node, children: swap(node.children, place.child as number, (place.child as number) + 1) }));
}

/** Under the item above, as its last child. */
export function indent(menu: Menu, key: string): Menu {
  const place = find(menu, key);
  if (!place || !canIndent(menu, key)) return menu;
  const node = menu[place.top];
  return menu.flatMap((entry, index) => {
    if (index === place.top) return [];
    return index === place.top - 1 ? [{ ...entry, children: [...entry.children, { ...node, children: [] }] }] : [entry];
  });
}

/** Out to the top level, right after the item it was under. */
export function outdent(menu: Menu, key: string): Menu {
  const place = find(menu, key);
  if (!place || place.child === null || !canOutdent(menu, key)) return menu;
  const child = menu[place.top].children[place.child];
  const remaining = menu[place.top].children.filter((_, index) => index !== place.child);
  return menu.flatMap((entry, index) => (index === place.top ? [{ ...entry, children: remaining }, child] : [entry]));
}

// --- drag and drop ----------------------------------------------------------------------------

/** Dropping on an item's top part puts the dragged one before it, its bottom part after it, its middle inside it. */
export type DropZone = 'before' | 'after' | 'inside';

/** Whether `dragKey` may be dropped `zone` of `targetKey`; 'inside' only onto a top item, and only for one with no items of its own. */
export function canDrop(menu: Menu, dragKey: string, targetKey: string, zone: DropZone): boolean {
  if (dragKey === targetKey) return false;
  const from = find(menu, dragKey);
  const to = find(menu, targetKey);
  if (!from || !to) return false;
  const dragged = itemAt(menu, from);
  if (zone === 'inside') {
    return to.child === null && dragged.children.length === 0 && menu[to.top].children.length < CHILDREN_MAX;
  }
  // Before or after an item sits next to it, so it takes that item's level: a top item with items of its
  // own can't go among the children of another.
  if (to.child !== null && dragged.children.length > 0) return false;
  const without = remove(menu, dragKey);
  return to.child !== null ? without[find(without, targetKey)?.top ?? 0].children.length < CHILDREN_MAX : without.length < TOP_ITEMS_MAX;
}

/** Moves an item to where it was dropped, or returns the menu as it was if that isn't allowed. */
export function moveTo(menu: Menu, dragKey: string, targetKey: string, zone: DropZone): Menu {
  if (!canDrop(menu, dragKey, targetKey, zone)) return menu;
  const from = find(menu, dragKey) as Place;
  const dragged = itemAt(menu, from);
  const without = remove(menu, dragKey);
  const to = find(without, targetKey) as Place;
  if (zone === 'inside') return withTop(without, to.top, (node) => ({ ...node, children: [...node.children, { ...dragged, children: [] }] }));
  const offset = zone === 'before' ? 0 : 1;
  if (to.child === null) return [...without.slice(0, to.top + offset), dragged, ...without.slice(to.top + offset)];
  return withTop(without, to.top, (node) => {
    const at = (to.child as number) + offset;
    return { ...node, children: [...node.children.slice(0, at), { ...dragged, children: [] }, ...node.children.slice(at)] };
  });
}

/** How many items there are, counting those under others. */
export function countItems(menu: Menu): number {
  return menu.reduce((total, node) => total + 1 + node.children.length, 0);
}
