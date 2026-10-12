import { cache } from 'react';
import type { Block, EntryView, SiteTheme, TypeListing } from 'cms-blocks';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

export type PublicSite = { name: string; subdomain: string; theme: SiteTheme };
/** What search engines and link previews get for a page (SEO-01); `api` has already applied the fallbacks. */
export type PublicSeo = {
  title: string;
  description: string | null;
  /** Only what staff entered; the page's own address is used otherwise. */
  canonicalUrl: string | null;
  noindex: boolean;
  social: { title: string; description: string | null; image: { url: string; alt: string } | null };
};
/** `entry` is present when the page is an entry of a content type (TYP-03). */
export type PublicPage = { title: string; path: string; blocks: Block[]; updatedAt: string; entry?: EntryView; seo: PublicSeo };
export type PreviewPage = Omit<PublicPage, 'seo'> & { status: 'draft' | 'published' };

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

async function getJson<T>(path: string, { fresh = false }: { fresh?: boolean } = {}): Promise<T | null> {
  const response = await fetch(`${API_URL}${path}`, fresh ? { cache: 'no-store' } : { next: { revalidate: PUBLIC_REVALIDATE_SECONDS } });
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

/** The addresses a site wants search engines to find (SEO-02); `null` for a site that doesn't exist. */
export type SitemapEntry = { path: string; lastModified: string; canonicalUrl: string | null };

// Read fresh, never cached: a sitemap file is not a page, so a path refresh doesn't clear the
// API answer behind it, and a crawler that fetches it a few times a day costs one read of the site's live rows.
export const getSitemap = cache((subdomain: string) =>
  getJson<{ entries: SitemapEntry[] }>(`/public/sites/${encodeURIComponent(subdomain)}/sitemap`, { fresh: true }),
);

/**
 * Where an old address sends visitors (GOV-05): a path on this site or a full URL, or
 * `null` when it redirects nowhere. Asked only after no page or listing answered.
 */
export const getRedirect = cache((subdomain: string, path: string) =>
  getJson<{ to: string }>(`/public/sites/${encodeURIComponent(subdomain)}/redirect?path=${encodeURIComponent(path)}`),
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
