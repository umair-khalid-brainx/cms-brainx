import { getSite } from '@/lib/publicApi';
import { siteOrigin } from '@/lib/seo';
import { robotsTxt } from '@/lib/sitemap';
import { isOwnHost } from '@/lib/tenant';

const ROOT_DOMAIN = process.env.PUBLIC_ROOT_DOMAIN ?? 'lvh.me';
const NOT_FOUND = { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } };

// Says only where the sitemap is. Built on every request, like the sitemap itself (SEO-02).
export const dynamic = 'force-dynamic';

/** `<host>/robots.txt`, reached through src/proxy.ts. An unknown site is a plain 404. */
export async function GET(request: Request, { params }: RouteContext<'/sites/[subdomain]/robots.txt'>) {
  const { subdomain } = await params;
  // Asked for directly on another host (this path skips the proxy): not this host's to give.
  if (!isOwnHost(request.headers.get('host'), ROOT_DOMAIN, subdomain)) return new Response('Not found', NOT_FOUND);
  if (!(await getSite(subdomain))) return new Response('Not found', NOT_FOUND);
  return new Response(robotsTxt(siteOrigin(subdomain)), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-cache' },
  });
}
