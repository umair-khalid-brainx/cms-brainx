import { z } from 'zod';

// A site's header and footer menus (GOV-03), as pure rules over a tree of items, so each one is
// tested without a database. A menu is a list of top items, each with at most one level of
// children, and an item is a page (by id, so it follows the page's slug and parent) or a link.

export const MENU_LOCATIONS = ['header', 'footer'] as const;
export type MenuLocation = (typeof MENU_LOCATIONS)[number];

export const LABEL_MAX = 80;
export const TOP_ITEMS_MAX = 20;
export const CHILDREN_MAX = 20;

/** Where a custom link may go: a path on the site, an anchor, a web address, an email or a phone number. */
function linkProblem(url: string): string | null {
  if (url.length > 500) return 'A link can be at most 500 characters.';
  if (url.startsWith('/')) return url.startsWith('//') || /[\s\\]/.test(url) ? 'Use a path like /about, or a full web address.' : null;
  if (url.startsWith('#')) return url.length > 1 && !/\s/.test(url) ? null : 'Use an anchor like #contact.';
  if (/^(mailto|tel):\S+$/i.test(url)) return null;
  if (/^https?:\/\//i.test(url)) {
    try {
      return new URL(url).hostname ? null : 'Use a full web address like https://example.com.';
    } catch {
      return 'Use a full web address like https://example.com.';
    }
  }
  return 'A link must start with https://, http://, mailto:, tel:, / or #.';
}

const itemFields = {
  label: z.string().trim().min(1, 'Every menu item needs a label.').max(LABEL_MAX, `A label can be at most ${LABEL_MAX} characters.`),
  contentId: z.string().min(1).max(100).optional(),
  url: z.string().trim().optional(),
};

/** Exactly one of a page or a link, and a link that goes somewhere allowed. */
function checkTarget(item: { label: string; contentId?: string; url?: string }, ctx: z.RefinementCtx) {
  const hasPage = item.contentId !== undefined;
  const hasUrl = item.url !== undefined && item.url !== '';
  if (hasPage === hasUrl) {
    ctx.addIssue({ code: 'custom', message: `“${item.label}” must be either a page or a link, not both and not neither.` });
    return;
  }
  const problem = hasUrl ? linkProblem(item.url as string) : null;
  if (problem) ctx.addIssue({ code: 'custom', message: `“${item.label}”: ${problem}` });
}

const childSchema = z.object(itemFields).superRefine(checkTarget);

const topSchema = z
  .object({ ...itemFields, children: z.array(childSchema).max(CHILDREN_MAX, `A menu item can have at most ${CHILDREN_MAX} items under it.`).default([]) })
  .superRefine(checkTarget);

/** The body of a save: the whole menu, as a tree two levels deep at most (a child can't have children). */
export const menuSchema = z.object({
  items: z.array(topSchema).max(TOP_ITEMS_MAX, `A menu can have at most ${TOP_ITEMS_MAX} top-level items.`),
});

export type MenuInput = z.infer<typeof menuSchema>;
export type MenuInputItem = MenuInput['items'][number];

/** Every page id a saved menu points at, once each, to check them against the site's pages. */
export function pageIdsOf(menu: MenuInput): string[] {
  const ids = new Set<string>();
  for (const item of menu.items) {
    if (item.contentId) ids.add(item.contentId);
    for (const child of item.children) if (child.contentId) ids.add(child.contentId);
  }
  return [...ids];
}

// --- what a visitor sees ----------------------------------------------------------------------

/** A stored menu as the database returns it: top items with their children, in order. */
export type StoredItem = { label: string; contentId: string | null; url: string | null; children?: StoredItem[] };

export type PageFacts = { path: string; status: string };

export type PublicMenuItem = {
  label: string;
  /** `null` for a heading that only holds the items under it. */
  href: string | null;
  children: { label: string; href: string }[];
};

/** Every page id the stored menus point at, once each, to look their addresses and statuses up in one query. */
export function storedPageIds(...menus: readonly (readonly StoredItem[])[]): string[] {
  const ids = new Set<string>();
  for (const item of menus.flat().flatMap((top) => [top, ...(top.children ?? [])])) {
    if (item.contentId) ids.add(item.contentId);
  }
  return [...ids];
}

/**
 * The menu as the public site shows it. A page item points at the page's current address, and a page
 * that isn't published is not shown: a menu never links to a draft or an archived page. A top item
 * whose own page is hidden but which has items under it stays as a heading with no link, so the
 * items under it aren't lost; with nothing under it, it goes. `pages` holds this site's pages only.
 */
export function publicMenu(items: readonly StoredItem[], pages: ReadonlyMap<string, PageFacts>): PublicMenuItem[] {
  const hrefOf = (item: StoredItem): string | null => {
    if (item.url) return item.url;
    const page = item.contentId ? pages.get(item.contentId) : undefined;
    return page && page.status === 'published' ? page.path : null;
  };
  const shown: PublicMenuItem[] = [];
  for (const item of items) {
    const children = (item.children ?? []).flatMap((child) => {
      const href = hrefOf(child);
      return href ? [{ label: child.label, href }] : [];
    });
    const href = hrefOf(item);
    if (href || children.length > 0) shown.push({ label: item.label, href, children });
  }
  return shown;
}
