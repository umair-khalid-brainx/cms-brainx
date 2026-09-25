import type { Data } from '@puckeditor/core';
import { corrickPages, type DemoPage } from '../data/corrickPages';
import type { EditorComponents } from '../puck/config';

// Two localStorage-backed layers on top of the seeded `corrickPages`, since
// there's no content API yet (CNT-01):
//  - a per-slug draft of a page's Puck data, autosaved from the editor so
//    navigating away no longer loses edits
//  - a list of wholly new pages created from the Dashboard's Quick Draft

const DRAFT_PREFIX = 'cms-admin.draft.';
const EXTRA_PAGES_KEY = 'cms-admin.extra-pages';

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort — private browsing / blocked storage shouldn't crash the app.
  }
}

export function saveDraft(slug: string, data: Data<EditorComponents>): void {
  writeJson(DRAFT_PREFIX + slug, data);
}

function readDraft(slug: string): Data<EditorComponents> | null {
  return readJson<Data<EditorComponents>>(DRAFT_PREFIX + slug);
}

function readExtraPages(): DemoPage[] {
  return readJson<DemoPage[]>(EXTRA_PAGES_KEY) ?? [];
}

function writeExtraPages(pages: DemoPage[]): void {
  writeJson(EXTRA_PAGES_KEY, pages);
}

/** The 4 seeded pages plus any Quick Draft pages, each with its autosaved
 * draft (if any) overlaid on top of its stored `data`. */
export function listPages(): DemoPage[] {
  return [...corrickPages, ...readExtraPages()].map((page) => {
    const draft = readDraft(page.slug);
    return draft ? { ...page, data: draft } : page;
  });
}

export function getPage(slug: string): DemoPage | undefined {
  return listPages().find((page) => page.slug === slug);
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || 'untitled';
}

function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Quick Draft only ever creates a new page — it never touches an existing
 * one, so it can't collide with the editor's per-slug draft autosave. */
export function createDraftPage(title: string, body: string): DemoPage {
  const taken = new Set(listPages().map((page) => page.slug));
  const slug = uniqueSlug(slugify(title), taken);

  const page: DemoPage = {
    slug,
    title: title.trim() || 'Untitled',
    path: `/${slug}`,
    status: 'draft',
    data: {
      root: {},
      content: body.trim()
        ? [{ type: 'RichText', props: { id: `${slug}-richtext-1`, html: `<p>${escapeHtml(body.trim())}</p>` } }]
        : [],
    },
  };

  writeExtraPages([...readExtraPages(), page]);
  return page;
}
