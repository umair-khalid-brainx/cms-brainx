import { NextResponse, type NextRequest } from 'next/server';
import { subdomainFromHost } from './lib/tenant';

const ROOT_DOMAIN = process.env.PUBLIC_ROOT_DOMAIN ?? 'lvh.me';

// `/__preview/<token>` on a tenant host is a preview link (CNT-09). No page
// slug can start with `_` (slugify strips it), so this never shadows a page.
const PREVIEW_PATH = /^\/__preview\/([A-Za-z0-9_-]+)\/?$/;

const REVALIDATE_PATH = '/__revalidate';

/**
 * Turns the tenant in the host into part of the route:
 * `corrick.lvh.me/wholesale` is rendered by `/sites/corrick/wholesale`.
 * The URL in the visitor's browser doesn't change — a rewrite, not a redirect.
 *
 * Putting the tenant in the route path (rather than reading `headers()` in
 * the page) is what makes the host part of Next's cache key — invariant 6,
 * and the base `CNT-08` builds ISR on. See DECISIONS.md D-030.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();

  // The API's on-demand revalidation call (CNT-08), on any host. Mapped to an
  // internal route that, like `/sites`, can't be reached directly; the route
  // itself checks the shared secret. `__` can't clash with a page slug.
  if (url.pathname === REVALIDATE_PATH) {
    url.pathname = '/internal/revalidate';
    return NextResponse.rewrite(url);
  }

  const subdomain = subdomainFromHost(request.headers.get('host'), ROOT_DOMAIN);
  const preview = subdomain ? PREVIEW_PATH.exec(url.pathname) : null;

  if (preview) {
    // Previews go to their own uncached route, outside `/sites` so they can
    // never land in a page's ISR cache entry. Like `/sites`, `/preview` itself
    // is unreachable directly: on a tenant host it's rewritten under `/sites`.
    url.pathname = `/preview/${subdomain}/${preview[1]}`;
  } else if (subdomain) {
    url.pathname = `/sites/${subdomain}${url.pathname === '/' ? '' : url.pathname}`;
  } else {
    // Not a tenant host (bare root domain, 127.0.0.1, ...). Rewritten to a
    // path no route matches, so it gets app/not-found.tsx with a 404 — and so
    // `/sites/<anything>` can't be reached directly, bypassing the host.
    url.pathname = '/no-site';
  }
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Everything except Next's own assets and files with an extension
    // (favicon.ico, images in public/).
    '/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)',
    // The two files with an extension that belong to a tenant (SEO-02): the rewrite above
    // sends them to `/sites/<subdomain>/sitemap.xml` and `/robots.txt`, so each host serves
    // its own. Exactly these two, so nothing else with an extension is let through.
    '/sitemap.xml',
    '/robots.txt',
  ],
};
