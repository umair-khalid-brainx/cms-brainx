import { cache } from 'react';
import type { Block, EntryView, SiteTheme, TermArchiveView, TypeListing } from 'cms-blocks';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

export type PublicSite = {
  name: string;
  subdomain: string;
  theme: SiteTheme;
  /** Shown beside the name in the header (GOV-04); empty if none. */
  tagline: string;
  /** Shown in the footer; empty if none. */
  footerNote: string;
  /** The logo as a full address, or null. */
  logo: { url: string } | null;
};
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
export type PublicPage = {
  title: string;
  path: string;
  blocks: Block[];
  updatedAt: string;
  entry?: EntryView;
  seo: PublicSeo;
};
// Any status but archived (GOV-07: a reviewer previews a page in review, or a scheduled one).
export type PreviewPage = Omit<PublicPage, 'seo'> & { status: 'draft' | 'published' | 'in_review' | 'scheduled' };

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

/**
 * The cache tag of everything a tenant's header and footer are built from (GOV-04). Each page
 * that read the site is cached together with this tag, so refreshing the tag refreshes every
 * page of that site and no other (invariant 6). A path refresh alone does not reach the site
 * data a layout reads.
 */
export const siteTag = (subdomain: string): string => `site:${subdomain}`;

async function getJson<T>(
  path: string,
  { fresh = false, tags }: { fresh?: boolean; tags?: string[] } = {},
): Promise<T | null> {
  const response = await fetch(
    `${API_URL}${path}`,
    fresh ? { cache: 'no-store' } : { next: { revalidate: PUBLIC_REVALIDATE_SECONDS, ...(tags && { tags }) } },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API ${response.status} for ${path}`);
  return (await response.json()) as T;
}

// cache(): the layout and generateMetadata both need the site; this makes it
// one API call per request, not two.
export const getSite = cache((subdomain: string) =>
  getJson<PublicSite>(`/public/sites/${encodeURIComponent(subdomain)}`, { tags: [siteTag(subdomain)] }),
);

// Tagged with the site too: a page's tags and social picture are worked out from the site's name and
// logo (the page's own `seo`), so a change to the site must refresh what each page read (GOV-04).
export const getPage = cache((subdomain: string, path: string) =>
  getJson<PublicPage>(`/public/sites/${encodeURIComponent(subdomain)}/page?path=${encodeURIComponent(path)}`, {
    tags: [siteTag(subdomain)],
  }),
);

/**
 * The page at a content type's address, like `/events`: its published entries, newest first (TYP-03).
 * `null` when no type has that address on this site, the same 404 as a missing page.
 */
export const getListing = cache((subdomain: string, prefix: string) =>
  getJson<TypeListing>(`/public/sites/${encodeURIComponent(subdomain)}/types/${encodeURIComponent(prefix)}`),
);

/**
 * A category or tag and one page of its published entries, newest first (TAX-02). `null` when the site has
 * no such term or the page is past the end: the same 404 as a missing page.
 *
 * Tagged with the site, like a page: publishing, unpublishing or retagging an entry, or renaming or deleting
 * a term, refreshes the site's tag and with it every archive page (D-058, D-061).
 */
export const getTermArchive = cache((subdomain: string, kind: 'category' | 'tag', slug: string, page: number) =>
  getJson<TermArchiveView>(
    `/public/sites/${encodeURIComponent(subdomain)}/terms/${kind}/${encodeURIComponent(slug)}?page=${page}`,
    { tags: [siteTag(subdomain)] },
  ),
);

/** One item of a menu as the public site shows it (GOV-03); `href` is `null` for a heading with items under it. */
export type MenuItem = { label: string; href: string | null; children: { label: string; href: string }[] };
export type PublicMenus = { header: MenuItem[]; footer: MenuItem[] };

// Tagged with the site, like the site itself: the menus are part of every page's header and footer,
// so a saved menu, or a page in it going live or off, refreshes them with the rest (GOV-03).
export const getMenus = cache((subdomain: string) =>
  getJson<PublicMenus>(`/public/sites/${encodeURIComponent(subdomain)}/menus`, { tags: [siteTag(subdomain)] }),
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
