import { getChrome, getSite } from '@/lib/publicApi';
import { fallbackChrome } from '@/site/fallbackChrome';
import { SiteFooter } from '@/site/SiteFooter';

// The footer counterpart of the @header slot.
export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export default async function FooterSlot({ params }: PageProps<'/sites/[subdomain]/[[...path]]'>) {
  const { subdomain, path } = await params;
  const [site, chrome] = await Promise.all([getSite(subdomain), getChrome(subdomain, path?.length ? `/${path.join('/')}` : '/').catch(() => null)]);
  if (!site) return null;
  const shown = (chrome ?? fallbackChrome(site)).footer;
  return shown ? <SiteFooter name={site.name} footer={shown} /> : null;
}
