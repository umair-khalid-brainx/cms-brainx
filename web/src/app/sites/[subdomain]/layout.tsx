import { notFound } from 'next/navigation';
import { getMenus, getSite } from '@/lib/publicApi';
import { SiteChrome } from '@/site/SiteChrome';
import { settingsFromSite } from '@/site/types';

/**
 * Reached only through src/proxy.ts's rewrite — `corrick.lvh.me/...` lands
 * here as `/sites/corrick/...`. Loads the site once for every page under it.
 *
 * An unknown subdomain (never existed, or renamed away from — D-031) throws
 * notFound() here, above this segment's own not-found.tsx, so it renders the
 * platform-level app/not-found.tsx ("no site at this address") rather than a
 * themed page for a site that doesn't exist.
 */
export default async function SiteLayout({ children, params }: LayoutProps<'/sites/[subdomain]'>) {
  const { subdomain } = await params;
  const [site, menus] = await Promise.all([getSite(subdomain), getMenus(subdomain).catch(() => null)]);
  if (!site) notFound();

  return <SiteChrome settings={settingsFromSite(site, menus)}>{children}</SiteChrome>;
}
