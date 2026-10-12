import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { BlockRenderer, ContactFormProvider, EntryHeader, EntryList, RelatedEntries } from 'cms-blocks';
import { getListing, getPage, getRedirect, getSite } from '@/lib/publicApi';
import { listingMetadata, pageMetadata, siteOrigin } from '@/lib/seo';
import { submitContactForm } from '@/site/contactFormAction';

// ISR (CNT-08): every page is rendered on its first visit, cached, and
// refreshed on demand by `api` or after 60 s at the latest. An empty list
// means nothing is prerendered at build — pages exist only in the database.
// The cache key is the rewritten path, `/sites/<subdomain>/...`, so it always
// includes the tenant (invariant 6). Must be a literal: Next reads it at build.
export const revalidate = 60;

export function generateStaticParams() {
  return [];
}

function toPath(segments: string[] | undefined): string {
  return segments?.length ? `/${segments.join('/')}` : '/';
}

export async function generateMetadata({ params }: PageProps<'/sites/[subdomain]/[[...path]]'>): Promise<Metadata> {
  const { subdomain, path } = await params;
  const [site, page] = await Promise.all([getSite(subdomain), getPage(subdomain, toPath(path))]);
  if (!site) return {};
  const origin = siteOrigin(subdomain);
  if (page) {
    return pageMetadata({ seo: page.seo, origin, path: page.path, siteName: site.name, article: Boolean(page.entry) });
  }
  if (path?.length === 1) {
    const listing = await getListing(subdomain, path[0]);
    if (listing) {
      return listingMetadata({ origin, path: `/${path[0]}`, typeName: listing.type.name, siteName: site.name, logoUrl: site.logo?.url });
    }
  }
  // Nothing here: the tab title of a missing page is set by this segment's not-found.tsx (B-15).
  return {};
}

/**
 * One published page of one tenant. Missing, draft and archived pages all
 * come back from the API as the same 404 (D-030), and all render this
 * segment's not-found.tsx inside the site's own header and footer.
 */
export default async function SitePage({ params }: PageProps<'/sites/[subdomain]/[[...path]]'>) {
  const { subdomain, path } = await params;
  const page = await getPage(subdomain, toPath(path));
  if (!page) {
    // `/events` is no page of its own but a content type's address: its listing (TYP-03).
    // A page can never take a type's address, so the two can't clash.
    const listing = path?.length === 1 ? await getListing(subdomain, path[0]) : null;
    if (listing) return <EntryList listing={listing} />;
    // An old address: sent on for good (GOV-05). A 308, Next's permanent redirect, which
    // search engines treat like a 301 (D-052). Only after the page and listing, so a page always wins.
    const redirect = await getRedirect(subdomain, toPath(path));
    if (redirect) permanentRedirect(redirect.to);
    notFound();
  }

  // The provider is how a ContactForm block on this page finds its server
  // action (D-034); the editor canvas has none, so its forms never send.
  return (
    <ContactFormProvider submit={submitContactForm}>
      {page.entry ? <EntryHeader title={page.title} entry={page.entry} /> : null}
      <BlockRenderer blocks={page.blocks} />
      {page.entry ? <RelatedEntries entries={page.entry.related} /> : null}
    </ContactFormProvider>
  );
}
