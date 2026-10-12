import type { Metadata } from 'next';
import { ArchivePage, archiveMetadataFor } from '@/site/archiveRoute';

// ISR like every public page (D-039): cached per tenant, refreshed on demand through the site's tag
// (an entry going live or off or being retagged, a term renamed or deleted) and after 60 s at the latest.
export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

export function generateMetadata({
  params,
}: PageProps<'/sites/[subdomain]/tag/[slug]/[[...rest]]'>): Promise<Metadata> {
  return archiveMetadataFor('tag', params);
}

export default function Page({ params }: PageProps<'/sites/[subdomain]/tag/[slug]/[[...rest]]'>) {
  return <ArchivePage kind="tag" params={params} />;
}
