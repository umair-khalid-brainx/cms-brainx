// The page tree on the admin side (CNT-05): the Pages list shows children under
// their parent, and the parent picker greys out choices the API would refuse.
// The API is the authority (api/src/content/page-tree.ts); this only guides.

/** Same limit as the API's: top level is depth 1. */
export const MAX_DEPTH = 3;

type TreeNode = { id: string; parentId: string | null; path: string };

/**
 * Pages with each child right under its parent, siblings in the order given. A page
 * whose parent isn't in the list (archived, say) shows at the top level.
 */
export function orderAsTree<T extends TreeNode>(pages: readonly T[]): { page: T; depth: number }[] {
  const ids = new Set(pages.map((page) => page.id));
  const children = new Map<string | null, T[]>();
  for (const page of pages) {
    const parent = page.parentId && ids.has(page.parentId) ? page.parentId : null;
    children.set(parent, [...(children.get(parent) ?? []), page]);
  }
  const ordered: { page: T; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (parent: string | null, depth: number) => {
    for (const page of children.get(parent) ?? []) {
      if (seen.has(page.id)) continue;
      seen.add(page.id);
      ordered.push({ page, depth });
      visit(page.id, depth + 1);
    }
  };
  visit(null, 1);
  return ordered;
}

export type ParentChoice<T> = { page: T; depth: number; disabledReason: string | null };

/** Every page as a possible parent for `pageId`, in tree order, with why it can't be one. */
export function parentChoices<T extends TreeNode>(pages: readonly T[], pageId: string): ParentChoice<T>[] {
  const ordered = orderAsTree(pages);
  const below = new Set<string>([pageId]);
  // Tree order lists every descendant after its parent, so one pass finds them all.
  for (const { page } of ordered) if (page.parentId && below.has(page.parentId)) below.add(page.id);
  const depthOf = new Map(ordered.map(({ page, depth }) => [page.id, depth]));
  // Levels from this page down, counting itself.
  const ownHeight = Math.max(1, ...[...below].map((id) => (depthOf.get(id) ?? 1) - (depthOf.get(pageId) ?? 1) + 1));

  return ordered.map(({ page, depth }) => ({
    page,
    depth,
    disabledReason:
      page.path === '/'
        ? 'the home page'
        : below.has(page.id)
          ? page.id === pageId
            ? 'this page'
            : 'inside this page'
          : depth + ownHeight > MAX_DEPTH
            ? 'too deep'
            : null,
  }));
}

/**
 * Whether any page below `pageId` is live: moving it moves their addresses too, so the API
 * asks for publish rights even when the page itself is a draft.
 */
export function hasLiveBelow(pages: readonly (TreeNode & { status: string })[], pageId: string): boolean {
  const below = new Set([pageId]);
  for (const { page } of orderAsTree(pages)) if (page.parentId && below.has(page.parentId)) below.add(page.id);
  return pages.some((page) => page.id !== pageId && below.has(page.id) && page.status === 'published');
}
