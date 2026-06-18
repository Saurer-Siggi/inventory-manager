# Saurer Siggi Inventory Manager

A small PWA for tracking inventory of Saurer Siggi Likör & Klopfer across storage locations.

- **SvelteKit** (adapter-node) + Tailwind CSS, mobile-first PWA
- **SQLite** via Node's built-in `node:sqlite` — single local file, zero DB dependencies
- **Shared-password auth** — one access password gates the whole app (cookie session)

## Development

```bash
npm install
cp .env.example .env      # set APP_PASSWORD and SESSION_SECRET
npm run dev               # http://localhost:3000
```

The SQLite file and its schema are created automatically on first run (default
`data/inventory.db`). It starts **empty** — populate it by migrating the old Supabase data:

```bash
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_KEY=<service_role key> \
DATABASE_PATH=data/inventory.db \
npm run migrate:supabase
```

Use the **service_role** key (Supabase → Settings → API); the anon key is blocked by the old
RLS policies. The script preserves ids, timestamps and quantities, and is safe to re-run.

Useful commands:

```bash
npm run check             # typecheck (svelte-check)
npm run build             # production build
npm run start             # run the built server (node build/index.js)
```

## Environment

| Variable         | Purpose                                                              |
| ---------------- | ------------------------------------------------------------------- |
| `APP_PASSWORD`   | Shared password required to log in.                                 |
| `SESSION_SECRET` | Secret used to sign the session cookie (use a long random string).  |
| `DATABASE_PATH`  | SQLite file path. Defaults to `data/inventory.db`.                  |
| `ORIGIN`         | Public URL in production (behind a TLS proxy) for CSRF on form POSTs. |

## Architecture

- Reads happen in server `load` functions (`+layout.server.ts`, `*/+page.server.ts`) and flow
  into Svelte stores.
- Mutations go through JSON API routes under `/api/*` (`transactions`, `products`, `storages`,
  `alerts`); the client calls them and then `invalidateAll()` to refresh.
- All DB access lives in `src/lib/server/db.ts`; auth helpers in `src/lib/server/auth.ts`.

## Deployment

Pushing to `main` runs `.github/workflows/docker-publish.yml`, which builds and pushes
`ghcr.io/saurer-siggi/siggi-inventory` and redeploys the VPS over SSH via `docker compose`.
The SQLite file persists in the `siggi-data` Docker volume (`/data/inventory.db`).

Required repo secrets: `HETZNER_IP`, `VPS_USER`, `SSH_PRIVATE_KEY`. The VPS must have
`/home/deploy/siggi-inventory/{docker-compose.yml,.env}` in place.
