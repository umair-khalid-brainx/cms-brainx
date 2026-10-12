/**
 * Whether this request really came in on `subdomain`'s own host. Files with an extension skip the
 * proxy, so `/sites/<x>/sitemap.xml` can be asked for on any host; the route that answers it checks
 * here, so a host only ever serves its own tenant (invariant 6, D-030).
 */
export function isOwnHost(host: string | null, rootDomain: string, subdomain: string): boolean {
  return subdomainFromHost(host, rootDomain) === subdomain;
}

/**
 * Which tenant a request is for, from its Host header (D-030).
 *
 * The host must be exactly one label under the configured root domain:
 * `corrick.lvh.me:3000` → `corrick`. The bare root (`lvh.me`), deeper names
 * (`a.b.lvh.me`), and any other host (`127.0.0.1`, `localhost`) are not a
 * tenant and return `null`.
 */
export function subdomainFromHost(host: string | null, rootDomain: string): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0].toLowerCase();
  const root = rootDomain.toLowerCase();

  const suffix = `.${root}`;
  if (!hostname.endsWith(suffix)) return null;

  const label = hostname.slice(0, -suffix.length);
  if (!label || label.includes('.')) return null;
  return label;
}
