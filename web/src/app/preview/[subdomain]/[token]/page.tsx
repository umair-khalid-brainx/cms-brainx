import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlockRenderer, EntryHeader } from 'cms-blocks';
import { getMenus, getPreview, getSite } from '@/lib/publicApi';
import { SiteChrome } from '@/site/SiteChrome';
import { settingsFromSite } from '@/site/types';

// Rendered per request, never cached (CNT-09): a revoked link must 404 at
// once and an editor's latest save must show on reload. Reached only via
// src/proxy.ts's `/__preview/<token>` rewrite on a tenant host.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/preview/[subdomain]/[token]'>): Promise<Metadata> {
  const { subdomain, token } = await params;
  const [site, page] = await Promise.all([getSite(subdomain), getPreview(subdomain, token)]);
  // A preview must never be indexed, even if the link leaks, and its URL
  // (the token) must not travel in a Referer header to sites it links to.
  const base: Metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' };
  if (!site || !page) return base;
  return { ...base, title: `Preview: ${page.title} · ${site.name}` };
}

/**
 * A page behind a preview link, inside its site's real header, footer and
 * theme, under a strip that says it's a preview. An unknown or revoked token,
 * or one for another site, is the same plain 404 as any missing page.
 */
export default async function PreviewPage({ params }: PageProps<'/preview/[subdomain]/[token]'>) {
  const { subdomain, token } = await params;
  const [site, page, menus] = await Promise.all([getSite(subdomain), getPreview(subdomain, token), getMenus(subdomain).catch(() => null)]);
  if (!site || !page) notFound();

  const banner = (
    <div
      role="note"
      className="bg-[var(--site-brand)] px-6 py-2 text-center text-sm text-[var(--site-on-brand)] sm:px-10"
    >
      <strong className="font-semibold">Private preview.</strong>{' '}
      {page.status === 'published'
        ? 'You’re seeing the latest saved version of this page, which may differ from what’s live.'
        : 'This page isn’t published yet. Only people with this link can see it.'}
    </div>
  );

  return (
    <SiteChrome settings={settingsFromSite(site, menus)} banner={banner}>
      {page.entry ? <EntryHeader title={page.title} entry={page.entry} /> : null}
      <BlockRenderer blocks={page.blocks} />
    </SiteChrome>
  );
}
