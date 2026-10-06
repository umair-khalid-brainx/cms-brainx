/**
 * Platform-level 404: the host isn't a site. Covers a subdomain no site has
 * (including one a site was renamed away from — D-031) and any request that
 * isn't on a tenant subdomain at all (src/proxy.ts). There's no tenant theme
 * to apply here, so this uses plain neutral styling.
 */
export default function SiteNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 px-6 font-[family-name:var(--font-plex-sans)] text-stone-900">
      <div className="flex max-w-md flex-col gap-4">
        <p className="font-[family-name:var(--font-plex-mono)] text-xs uppercase tracking-[0.14em] text-stone-500">
          Error 404
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">There&rsquo;s no site at this address</h1>
        <p className="leading-relaxed text-stone-600">
          Check the address for typos. If this site was renamed, its old address no longer works — ask the site
          owner for the new one.
        </p>
      </div>
    </main>
  );
}
