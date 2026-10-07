import { cache } from 'react';
import type { Block, SiteTheme } from 'cms-blocks';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

export type PublicSite = { name: string; subdomain: string; theme: SiteTheme };
export type PublicPage = { title: string; path: string; blocks: Block[]; updatedAt: string };
export type PreviewPage = PublicPage & { status: 'draft' | 'published' };

/**
 * Both reads hit the API's unauthenticated `/public` routes, which only ever
 * return live content (D-030). `null` means 404 — unknown site, or a page
 * that is missing, draft or archived; the API doesn't say which, on purpose.
 *
 * `no-store` for now: every request renders fresh, so a publish or a
 * subdomain rename shows up immediately. Caching with on-demand revalidation
 * on publish is `CNT-08`.
 */
async function getJson<T>(path: string): Promise<T | null> {
  const response = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
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
 * A page behind a preview link (CNT-09): its latest saved blocks, draft or
 * not. Never cached — a revoked link must stop working on the next request,
 * and an edit must show on the next reload.
 */
export async function getPreview(subdomain: string, token: string): Promise<PreviewPage | null> {
  const path = `/public/sites/${encodeURIComponent(subdomain)}/preview/${encodeURIComponent(token)}`;
  const response = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API ${response.status} for preview`);
  return (await response.json()) as PreviewPage;
}
