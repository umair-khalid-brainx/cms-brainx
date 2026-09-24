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

## Temporary, delete later

`src/app/page.tsx` (two-tenant comparison view) and `src/app/preview/[site]/` exist only until the
real host-resolved catch-all route lands (`CNT-07`). Tracked as `../docs/BACKLOG.md` B-07.
Fixtures in `src/fixtures/` stand in for rows in `content`.
