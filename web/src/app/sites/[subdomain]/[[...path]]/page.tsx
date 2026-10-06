import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlockRenderer } from 'cms-blocks';
import { getPage, getSite } from '@/lib/publicApi';

function toPath(segments: string[] | undefined): string {
  return segments?.length ? `/${segments.join('/')}` : '/';
}

export async function generateMetadata({ params }: PageProps<'/sites/[subdomain]/[[...path]]'>): Promise<Metadata> {
  const { subdomain, path } = await params;
  const [site, page] = await Promise.all([getSite(subdomain), getPage(subdomain, toPath(path))]);
  if (!site || !page) return {};
  return { title: page.path === '/' ? site.name : `${page.title} · ${site.name}` };
}

/**
 * One published page of one tenant. Missing, draft and archived pages all
 * come back from the API as the same 404 (D-030), and all render this
 * segment's not-found.tsx inside the site's own header and footer.
 */
export default async function SitePage({ params }: PageProps<'/sites/[subdomain]/[[...path]]'>) {
  const { subdomain, path } = await params;
  const page = await getPage(subdomain, toPath(path));
  if (!page) notFound();

  return <BlockRenderer blocks={page.blocks} />;
}
