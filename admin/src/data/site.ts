import { getSession } from '../lib/auth';

// The subdomain comes from the session (D-030); the title and the rest of the site's identity
// come from the API (GOV-04, lib/siteApi.ts).
// Where `web` serves a tenant. `{subdomain}` is replaced per site:
// locally `http://corrick.lvh.me:3000`, in production `https://corrick.<root>`.
const SITE_URL_TEMPLATE: string = import.meta.env.VITE_SITE_URL_TEMPLATE ?? 'http://{subdomain}.lvh.me:3000';

const [ADDRESS_PREFIX, ADDRESS_SUFFIX] = SITE_URL_TEMPLATE.split('{subdomain}');

/** The parts around the subdomain, for an input like `http://[corrick].lvh.me:3000`. */
export const siteAddressParts = { prefix: ADDRESS_PREFIX, suffix: ADDRESS_SUFFIX ?? '' };

export function currentSubdomain(): string | undefined {
  return getSession()?.memberships[0]?.siteSubdomain;
}

/** The public URL for a page path on the current site. */
export function siteUrl(path: string = '/', subdomain: string | undefined = currentSubdomain()): string {
  const origin = SITE_URL_TEMPLATE.replace('{subdomain}', subdomain ?? '');
  return path === '/' ? origin : `${origin}${path}`;
}

/** Where `web` serves a preview link (CNT-09); `/__preview/` can't clash with a page slug. */
export function previewUrl(token: string, subdomain: string | undefined = currentSubdomain()): string {
  return `${siteUrl('/', subdomain)}/__preview/${token}`;
}
