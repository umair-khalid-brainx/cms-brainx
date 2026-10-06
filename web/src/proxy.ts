import { NextResponse, type NextRequest } from 'next/server';
import { subdomainFromHost } from './lib/tenant';

const ROOT_DOMAIN = process.env.PUBLIC_ROOT_DOMAIN ?? 'lvh.me';

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
  const subdomain = subdomainFromHost(request.headers.get('host'), ROOT_DOMAIN);
  const url = request.nextUrl.clone();

  // Not a tenant host (bare root domain, 127.0.0.1, ...). Rewritten to a path
  // no route matches, so it gets app/not-found.tsx with a 404 — and so
  // `/sites/<anything>` can't be reached directly, bypassing the host.
  url.pathname = subdomain ? `/sites/${subdomain}${url.pathname === '/' ? '' : url.pathname}` : '/no-site';
  return NextResponse.rewrite(url);
}

export const config = {
  // Everything except Next's own assets and files with an extension
  // (favicon.ico, images in public/).
  matcher: ['/((?!_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)'],
};
