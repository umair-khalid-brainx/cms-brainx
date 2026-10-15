import { getChrome, getSite } from '@/lib/publicApi';
import { fallbackChrome } from '@/site/fallbackChrome';
import { SiteHeader } from '@/site/SiteHeader';

// The site's header for the page at this address: its own, a saved one, or none (the page hides it).
// Same cache rules as the page itself (D-039); the data is tagged with the site, so a saved header,
// menu or page choice refreshes it.
export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export default async function HeaderSlot({ params }: PageProps<'/sites/[subdomain]/[[...path]]'>) {
  const { subdomain, path } = await params;
  const [site, chrome] = await Promise.all([getSite(subdomain), getChrome(subdomain, path?.length ? `/${path.join('/')}` : '/').catch(() => null)]);
  if (!site) return null;
  const shown = (chrome ?? fallbackChrome(site)).header;
  return shown ? <SiteHeader name={site.name} header={shown} /> : null;
}
