// Pages nest (CNT-05): `/about/team` sits under `/about`. A page's `path` is derived
// from its parents' slugs and stored (invariant 9), so moving a page — a new slug, a
// new parent, or both — recomputes the path of every page below it too (CNT-06).
// Pure functions over one site's pages, so every rule can be tested without a database.

/** Top level is depth 1, so `/a/b/c` is as deep as a page can sit. */
export const MAX_DEPTH = 3;

export type TreePage = {
  id: string;
  parentId: string | null;
  slug: string;
  path: string;
  status: string;
  /** Set once it first went live; a page that was ever public needs a redirect when it moves (GOV-05). */
  publishedAt?: Date | null;
};

/** One page whose address changes in a move: the page itself or one below it. */
export type PathMove = { id: string; oldPath: string; newPath: string; status: string; everPublished: boolean };

/** `conflict` marks a clash with another page's address (a 409), the rest are bad requests. */
export type MovePlan = { ok: true; path: string; moves: PathMove[] } | { ok: false; problem: string; conflict?: boolean };

/**
 * Where a page and everything under it end up if it takes `slug` under `parentId`
 * (null for the top level), or why it can't. `pages` is every page of one site and
 * nothing else, so a parent from another site or an entry is simply not found.
 * Paths are rebuilt from the parent links, not from the stored paths.
 */
export function planMove(pages: readonly TreePage[], pageId: string, slug: string, parentId: string | null): MovePlan {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const page = byId.get(pageId);
  if (!page) return { ok: false, problem: 'Page not found.' };

  let parentPath = '';
  let parentDepth = 0;
  if (parentId !== null) {
    const parent = byId.get(parentId);
    if (!parent) return { ok: false, problem: 'That parent page doesn’t exist on this site.' };
    if (parent.path === '/') return { ok: false, problem: 'Pages can’t sit under the home page.' };
    if (parent.id === page.id || ancestorIds(byId, parent).includes(page.id)) {
      return { ok: false, problem: 'A page can’t sit under itself or one of its own child pages.' };
    }
    parentPath = parent.path;
    parentDepth = ancestorIds(byId, parent).length + 1;
  }

  const children = childrenOf(pages);
  if (parentDepth + height(children, page.id) > MAX_DEPTH) {
    return { ok: false, problem: `Pages can be nested at most ${MAX_DEPTH} levels deep.` };
  }

  const path = `${parentPath}/${slug}`;
  const moves: PathMove[] = [];
  const visit = (current: TreePage, newPath: string) => {
    if (current.path !== newPath) {
      const everPublished = current.status === 'published' || Boolean(current.publishedAt);
      moves.push({ id: current.id, oldPath: current.path, newPath, status: current.status, everPublished });
    }
    for (const child of children.get(current.id) ?? []) visit(child, `${newPath}/${child.slug}`);
  };
  visit(page, path);

  // Every new address must be free, except where a page of this same subtree is moving away from it.
  const moving = new Set<string>();
  const collect = (id: string) => {
    moving.add(id);
    for (const child of children.get(id) ?? []) collect(child.id);
  };
  collect(page.id);
  const taken = new Set(pages.filter((other) => !moving.has(other.id)).map((other) => other.path));
  const clash = moves.find((move) => taken.has(move.newPath));
  if (clash) return { ok: false, problem: `Another page already lives at ${clash.newPath}.`, conflict: true };

  return { ok: true, path, moves };
}

/** How many levels deep a new page would sit under `parentId`, for the create checks. */
export function depthUnder(pages: readonly TreePage[], parentId: string): number {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const parent = byId.get(parentId);
  return parent ? ancestorIds(byId, parent).length + 2 : 0;
}

/** Ids above `page`, nearest first. Stops at a missing parent or a loop, so bad data can't hang it. */
function ancestorIds(byId: Map<string, TreePage>, page: TreePage): string[] {
  const ids: string[] = [];
  let current = page.parentId ? byId.get(page.parentId) : undefined;
  while (current && !ids.includes(current.id)) {
    ids.push(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return ids;
}

function childrenOf(pages: readonly TreePage[]): Map<string, TreePage[]> {
  const children = new Map<string, TreePage[]>();
  for (const page of pages) {
    if (!page.parentId) continue;
    children.set(page.parentId, [...(children.get(page.parentId) ?? []), page]);
  }
  return children;
}

/** Levels in the subtree from `id` down, counting itself: a page with no children is 1. */
function height(children: Map<string, TreePage[]>, id: string, seen = new Set<string>()): number {
  if (seen.has(id)) return 0;
  seen.add(id);
  return 1 + Math.max(0, ...(children.get(id) ?? []).map((child) => height(children, child.id, seen)));
}
