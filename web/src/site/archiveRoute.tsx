import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TermArchive } from 'cms-blocks';
import { archivePage } from '@/lib/archive';
import { getSite, getTermArchive } from '@/lib/publicApi';
import { archiveMetadata } from '@/lib/seo';

// The pages at `/category/<slug>` and `/tag/<slug>` (TAX-02), one implementation behind two route files
// (a route segment's `revalidate` must be a literal in the file itself, so each keeps its own).
// An unknown term, another site's term or a page past the end are all notFound(): the site's own
// themed 404, the same as for a missing page.

type Params = Promise<{ subdomain: string; slug: string; rest?: string[] }>;

export async function archiveMetadataFor(kind: 'category' | 'tag', params: Params): Promise<Metadata> {
  const { subdomain, slug, rest } = await params;
  const page = archivePage(rest);
  if (page === null) return {};
  const [site, archive] = await Promise.all([getSite(subdomain), getTermArchive(subdomain, kind, slug, page)]);
  if (!site || !archive) return {};
  return archiveMetadata({ kind, termName: archive.term.name, siteName: site.name, page });
}

export async function ArchivePage({ kind, params }: { kind: 'category' | 'tag'; params: Params }) {
  const { subdomain, slug, rest } = await params;
  const page = archivePage(rest);
  if (page === null) notFound();
  const archive = await getTermArchive(subdomain, kind, slug, page);
  if (!archive) notFound();
  return <TermArchive archive={archive} />;
}
