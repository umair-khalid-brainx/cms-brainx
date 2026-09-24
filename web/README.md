# cms-web

Next.js (App Router) renderer for the **public tenant sites**. Server-rendered
so that meta tags, canonical URLs and sitemaps are real HTML rather than
client-side decoration. Tenants are resolved from the request host; page content
comes from `cms-api` over REST.

## Prerequisites

- Node 22 (`.nvmrc`)
- `cms-api` running (default `http://localhost:4001`)

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev                 # http://localhost:3000
```

`.env.local`:

```
NEXT_PUBLIC_API_URL="http://localhost:4001"
DEFAULT_TENANT_HOST="localhost:3000"   # fallback tenant for local dev
```

## Scripts

| Script              | Does                          |
| ------------------- | ----------------------------- |
| `npm run dev`       | dev server on :3000           |
| `npm run build`     | production build              |
| `npm start`         | serve the build on :3000      |
| `npm run lint`      | eslint                        |
| `npm run typecheck` | `tsc --noEmit`                |

## Blocks and theming

```
src/blocks/         block types, registry, renderer, and one component per block
src/theme/          SiteTheme type, presets, and the CSS-variable wrapper
src/site/           header, footer, and the whole-site composition
src/fixtures/       two demo tenants standing in for rows in `content`
```

**The contract:** a block component may reference `--site-*` custom properties
and nothing else. No block carries a colour, typeface, radius or spacing value
of its own, so any tenant can restyle every block through `theme_json` alone.
This is enforceable in review with a grep:

```bash
grep -rnE '#[0-9a-fA-F]{3,8}\b' src/blocks src/site      # must return nothing
```

`/` renders both tenants with a control that swaps their themes. If a block ever
hardcodes a colour, swapping shows it immediately.

**Adding a block:** add its type to the `Block` union in `blocks/types.ts`, write
the component, and register it in `blocks/registry.ts`. The registry is typed as
`{ [T in BlockType]: BlockDefinition<T> }`, so a type without a component — or a
component without a type — is a compile error rather than a blank section.

**Routes:** `/preview/[site]` renders one tenant by slug. The real route resolves
a tenant from the request host; the preview exists so block and theme work can
proceed before host resolution and the database are wired up.

## Notes

- Tailwind CSS 4 via `@tailwindcss/postcss`.
- Block components are colour-agnostic by rule (see above); tenant palettes live
  in `src/fixtures/*` today and move to the `sites` table later.
- Fixture artwork in `public/media/` is hand-written SVG, so there are no binary
  assets and no remote image hosts to configure yet. `next/image` arrives with
  the media library.
- Blocks are intended to be React components shared between the editor canvas in
  `cms-admin` and this renderer, so preview is exact rather than approximate.
  Since the projects are separate repos, that sharing happens through a
  published package or a copied block registry — not a workspace import.
- ISR cache keys must include the request host, or one tenant can be served
  another tenant's page.
