# Multi-Tenant CMS

Three **independent** projects sharing one git repository, each with its own
`node_modules`. Nothing is shared between them at build time; they communicate
only over REST.

| Folder  | What it is                                        | Dev port |
| ------- | -------------------------------------------------- | -------- |
| `api/`  | NestJS + Prisma + Postgres — owns the data         | 4001*    |
| `web/`  | Next.js (SSR + ISR) — all public tenant sites      | 3000     |
| `admin/`| React SPA (Vite) — admin panel                     | 5173     |

\* Canonical port is 4000 (per the scope doc); 4000 is held by Local (the
WordPress tool) on this machine, so `api/.env` overrides it via `API_PORT`.

Each project has its own README with setup and scripts. Start `api` first, since
the other two read from it.

```bash
(cd api && npm run dev)      # :4001
(cd web && npm run dev)      # :3000
(cd admin && npm run dev)    # :5173
```

Production topology (single EC2 + nginx): `*.<domain>` → web,
`admin.<domain>` → admin static build, `api.<domain>` → api.

Scope, architecture and estimates: `cms-poc-scope-and-estimates` (Revision 2).
