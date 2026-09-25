import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SiteChrome } from '@/site/SiteChrome';
import { getSiteFixture, siteSlugs } from '@/fixtures/sites';
import type { SiteFixture } from '@/site/types';

/**
 * Dev preview of one tenant, addressed by slug, now with one route per page
 * instead of just the home page. The real route resolves a tenant from the
 * request host and a page from its path directly (no `/preview/[site]`
 * prefix); this exists so multi-page and block work can proceed before host
 * resolution and the database are wired up — see `../CLAUDE.md` "Temporary,
 * delete later".
 */
export function generateStaticParams() {
  return siteSlugs.flatMap((site) => {
    const fixture = getSiteFixture(site);
    if (!fixture) return [];
    return fixture.pages.map((page) => ({
      site,
      path: page.path === '/' ? [] : page.path.replace(/^\//, '').split('/'),
    }));
  });
}

function resolvePage(fixture: SiteFixture, path: string[] | undefined) {
  const pagePath = path && path.length ? `/${path.join('/')}` : '/';
  return fixture.pages.find((page) => page.path === pagePath);
}

/**
 * Fixture hrefs are production-shaped (`/wholesale`, not `/preview/corrick/
 * wholesale`) — correct once the real host-resolved route lands, wrong under
 * this temporary `/preview/[site]` prefix. That applies to nav and footer
 * links *and* to any `href` inside a page's blocks (a Hero's `primaryAction`,
 * a Cta's `action`, ...) — link fields are scattered across all 14 block
 * types' props, so rather than special-case each one this walks any
 * JSON-shaped value and prefixes every `href` key that starts with `/`.
 * Anchors (`#shares`) are left alone since they're same-page regardless.
 */
function prefixHrefs<T>(value: T, basePath: string): T {
  if (Array.isArray(value)) {
    return value.map((item) => prefixHrefs(item, basePath)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, val]) => [
      key,
      key === 'href' && typeof val === 'string' && val.startsWith('/') ? `${basePath}${val}` : prefixHrefs(val, basePath),
    ]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

function withPreviewBase(fixture: SiteFixture, basePath: string): SiteFixture {
  return prefixHrefs(fixture, basePath);
}

export async function generateMetadata({
  params,
}: PageProps<'/preview/[site]/[[...path]]'>): Promise<Metadata> {
  const { site, path } = await params;
  const fixture = getSiteFixture(site);
  if (!fixture) return {};
  const page = resolvePage(fixture, path);
  if (!page) return {};

  return {
    title: page.title,
    description: fixture.settings.footer.note,
  };
}

export default async function SitePreviewPage({ params }: PageProps<'/preview/[site]/[[...path]]'>) {
  const { site, path } = await params;
  const fixture = getSiteFixture(site);
  if (!fixture) notFound();

  // Prefixed before resolving the page, not after: `path` fields (what
  // `resolvePage` matches on) are untouched by prefixHrefs — it only rewrites
  // `href` keys — so resolving against either fixture finds the same page,
  // but resolving after guarantees the returned page's own blocks are prefixed too.
  const previewFixture = withPreviewBase(fixture, `/preview/${site}`);
  const page = resolvePage(previewFixture, path);
  if (!page) notFound();

  return <SiteChrome site={previewFixture} page={page} />;
}
