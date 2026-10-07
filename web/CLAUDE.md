@AGENTS.md

# cms-web — repo guide

Platform-wide guide and docs: **[../CLAUDE.md](../CLAUDE.md)** and **[../docs/](../docs/)**.
Read those first; this file covers only what is specific to this repo.

Next.js 16 App Router. Renders **all public tenant sites**: one catch-all route, tenant resolved
from the request `Host` header, SSR + ISR.

## Invariants for this repo

1. **Server-rendered, deliberately.** The SEO surface — meta titles, canonical URLs, sitemaps,
   no-index — is only real if the server returns real HTML. Tenant pages stay server components.
   Page source will be inspected during the pitch.
2. **Block components come from `cms-blocks`**, never a local copy. See `../docs/DECISIONS.md` D-008.
3. **Blocks are colour-agnostic**: `--site-*` custom properties only, no hex values and no Tailwind
   palette classes. Verify: `grep -rnE '#[0-9a-fA-F]{3,8}\b' src/blocks src/theme` → nothing.
4. **ISR cache keys must include the host.** A key on path alone serves tenant A's page to tenant B.
   Test with two hosts.
5. **Never sanitise on read.** Stored HTML was sanitised on write.
6. An unknown block type is skipped, not thrown on — a page saved with a block a later deploy
   removed must still render the rest of itself.

## Gotchas

- **`turbopack.root` must stay set** in `next.config.ts`, or Turbopack walks up past this repo and
  warns about a lockfile outside it.
- **`.gitignore` ignores `.env*`**, so the `!.env.example` negation is required.
- **`localhost:3000` may 308-redirect to `/en` and 404** — a stale cached redirect from an unrelated
  project on that origin, not a bug here. Use `http://127.0.0.1:3000` or clear site data.
- **Headless Chrome `--window-size` does not reliably set layout width.** For responsive checks,
  render the page in a fixed-width `<iframe>` in a probe page and screenshot that.
- `NEXT_PUBLIC_API_URL` points at **`:4001`** locally, not 4000.
- `REVALIDATE_SECRET` must match `api`'s, or every on-demand refresh is a 403 and pages update only
  on the 60 s timer.
- **`_folder` is a private folder in the App Router** and never becomes a route; that's why the
  internal tenant route is `/sites/...`, not `/_sites/...`.
- **`allowedDevOrigins: ["*.lvh.me"]`** in `next.config.ts` is required, or `next dev` blocks its own
  dev assets and HMR on tenant hosts.
- **ISR only exists in `next build && next start`.** Under `next dev` every request renders fresh,
  so "my edit showed up" in dev proves nothing about the cache. The `x-nextjs-cache` response header
  says HIT/MISS/STALE (D-039).
- **`revalidatePath` takes the rewrite destination** (`/sites/corrick/about`), not the visitor's URL
  (`/about`). The visitor's URL matches no cache entry, so the call silently does nothing.

## How a request finds its tenant

`src/proxy.ts` (Next 16's name for middleware) strips `PUBLIC_ROOT_DOMAIN` from the `Host` header
and rewrites `corrick.lvh.me/wholesale` to `/sites/corrick/wholesale`. `app/sites/[subdomain]/layout.tsx`
loads the site, `[[...path]]/page.tsx` loads the page, both from `api`'s unauthenticated `/public`
routes in `src/lib/publicApi.ts`. Two 404s: `app/not-found.tsx` (no such site, plain styling) and
`app/sites/[subdomain]/not-found.tsx` (no such live page, inside the site's theme). See
`../docs/DECISIONS.md` D-030, D-031.
