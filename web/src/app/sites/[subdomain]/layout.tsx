import { notFound } from 'next/navigation';
import { getSite } from '@/lib/publicApi';
import { SiteFrame } from '@/site/SiteChrome';

/**
 * Reached only through src/proxy.ts's rewrite — `corrick.lvh.me/...` lands
 * here as `/sites/corrick/...`. Loads the site once for every page under it.
 *
 * The header and footer are the `@header` and `@footer` slots, not drawn here: a page can pick its own
 * saved ones or hide them, and a layout can't see which page it wraps, but a slot gets the same
 * address as the page does.
 *
 * An unknown subdomain (never existed, or renamed away from — D-031) throws
 * notFound() here, above this segment's own not-found.tsx, so it renders the
 * platform-level app/not-found.tsx ("no site at this address") rather than a
 * themed page for a site that doesn't exist.
 */
export default async function SiteLayout({ children, header, footer, params }: LayoutProps<'/sites/[subdomain]'>) {
  const { subdomain } = await params;
  const site = await getSite(subdomain);
  if (!site) notFound();

  return (
    <SiteFrame theme={site.theme} header={header} footer={footer}>
      {children}
    </SiteFrame>
  );
}
