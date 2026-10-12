import { getSitemap } from '@/lib/publicApi';
import { siteOrigin } from '@/lib/seo';
import { sitemapXml } from '@/lib/sitemap';
import { isOwnHost } from '@/lib/tenant';

const ROOT_DOMAIN = process.env.PUBLIC_ROOT_DOMAIN ?? 'lvh.me';
const NOT_FOUND = { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } };

// Built on every request, per tenant (the subdomain is part of the route), so it is never behind
// a publish, an unpublish, a move or a noindex change (SEO-02). Not cached like the pages: a
// refresh of the path doesn't reach the API answer behind a route file, and crawlers ask rarely.
export const dynamic = 'force-dynamic';

/** `<host>/sitemap.xml`, reached through src/proxy.ts. An unknown site is a plain 404. */
export async function GET(request: Request, { params }: RouteContext<'/sites/[subdomain]/sitemap.xml'>) {
  const { subdomain } = await params;
  // Asked for directly on another host (this path skips the proxy): not this host's to give.
  if (!isOwnHost(request.headers.get('host'), ROOT_DOMAIN, subdomain)) return new Response('Not found', NOT_FOUND);
  const sitemap = await getSitemap(subdomain);
  if (!sitemap) return new Response('Not found', NOT_FOUND);
  return new Response(sitemapXml(siteOrigin(subdomain), sitemap.entries), {
    // `no-cache`: keep a copy if you like, but ask again before using it, so nothing in front of us
    // can serve a sitemap that is behind a publish.
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'no-cache' },
  });
}
