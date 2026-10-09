import { timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';

/**
 * On-demand ISR (CNT-08): `api` POSTs `{ subdomain, path }` here after a
 * change to a live page, and the next visit to that page — on that host only
 * — renders fresh. Reached as `/__revalidate` via src/proxy.ts; this route's
 * own path is unreachable from outside.
 *
 * The cache entry to clear is the rewrite *destination*, `/sites/<sub><path>`,
 * not the URL the visitor sees (Next's revalidatePath docs, "with rewrites").
 * That destination carries the tenant, which is what keeps one site's
 * refresh from touching another's (invariant 6).
 */

const SUBDOMAIN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function hasSecret(request: Request): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  const given = request.headers.get('x-revalidate-secret');
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!hasSecret(request)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { subdomain?: unknown; path?: unknown } | null;
  const subdomain = typeof body?.subdomain === 'string' ? body.subdomain : '';
  const path = typeof body?.path === 'string' ? body.path : '';
  if (!SUBDOMAIN.test(subdomain) || !path.startsWith('/')) {
    return Response.json({ error: 'Expected { subdomain, path }' }, { status: 400 });
  }

  const destination = path === '/' ? `/sites/${subdomain}` : `/sites/${subdomain}${path}`;
  revalidatePath(destination);
  return Response.json({ revalidated: destination });
}
