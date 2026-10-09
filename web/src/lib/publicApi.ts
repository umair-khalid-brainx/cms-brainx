import { cache } from 'react';
import type { Block, EntryView, SiteTheme, TypeListing } from 'cms-blocks';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

export type PublicSite = { name: string; subdomain: string; theme: SiteTheme };
/** `entry` is present when the page is an entry of a content type (TYP-03). */
export type PublicPage = { title: string; path: string; blocks: Block[]; updatedAt: string; entry?: EntryView };
export type PreviewPage = PublicPage & { status: 'draft' | 'published' };

/**
 * Both reads hit the API's unauthenticated `/public` routes, which only ever
 * return live content (D-030). `null` means 404 — unknown site, or a page
 * that is missing, draft or archived; the API doesn't say which, on purpose.
 *
 * Cached (CNT-08, D-039): a page and the fetches behind it are kept for up to
 * `PUBLIC_REVALIDATE_SECONDS`, and `api` clears a page the moment it changes
 * (publish, unpublish, archive, saving a live page) via `/__revalidate`. The
 * timer is only the backstop — for a theme or subdomain change, which isn't
 * pushed, and for a refresh call that never arrived.
 */
export const PUBLIC_REVALIDATE_SECONDS = 60;

async function getJson<T>(path: string): Promise<T | null> {
  const response = await fetch(`${API_URL}${path}`, { next: { revalidate: PUBLIC_REVALIDATE_SECONDS } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API ${response.status} for ${path}`);
  return (await response.json()) as T;
}

// cache(): the layout and generateMetadata both need the site; this makes it
// one API call per request, not two.
export const getSite = cache((subdomain: string) =>
  getJson<PublicSite>(`/public/sites/${encodeURIComponent(subdomain)}`),
);

export const getPage = cache((subdomain: string, path: string) =>
  getJson<PublicPage>(`/public/sites/${encodeURIComponent(subdomain)}/page?path=${encodeURIComponent(path)}`),
);

/**
 * The page at a content type's address, like `/events`: its published entries, newest first (TYP-03).
 * `null` when no type has that address on this site, the same 404 as a missing page.
 */
export const getListing = cache((subdomain: string, prefix: string) =>
  getJson<TypeListing>(`/public/sites/${encodeURIComponent(subdomain)}/types/${encodeURIComponent(prefix)}`),
);

/**
 * A page behind a preview link (CNT-09): its latest saved blocks, draft or
 * not. Never cached — a revoked link must stop working on the next request,
 * and an edit must show on the next reload.
 */
// cache() only dedupes within one request (metadata + page) — still a fresh
// fetch on every view.
export const getPreview = cache(async (subdomain: string, token: string): Promise<PreviewPage | null> => {
  const path = `/public/sites/${encodeURIComponent(subdomain)}/preview/${encodeURIComponent(token)}`;
  const response = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API ${response.status} for preview`);
  return (await response.json()) as PreviewPage;
});
