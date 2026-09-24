import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SiteChrome } from '@/site/SiteChrome';
import { getSiteFixture, siteSlugs } from '@/fixtures/sites';

/**
 * Dev preview of one tenant, addressed by slug. The real route resolves a
 * tenant from the request host instead; this exists so block and theme work can
 * proceed before host resolution and the database are wired up.
 */
export function generateStaticParams() {
  return siteSlugs.map((site) => ({ site }));
}

export async function generateMetadata({ params }: PageProps<'/preview/[site]'>): Promise<Metadata> {
  const { site } = await params;
  const fixture = getSiteFixture(site);
  if (!fixture) return {};

  return {
    title: fixture.page.title,
    description: fixture.settings.footer.note,
  };
}

export default async function SitePreviewPage({ params }: PageProps<'/preview/[site]'>) {
  const { site } = await params;
  const fixture = getSiteFixture(site);
  if (!fixture) notFound();

  return <SiteChrome site={fixture} />;
}
