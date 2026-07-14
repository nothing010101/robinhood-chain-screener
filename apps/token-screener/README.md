# Robinhood Chain Screener

Live token screener for [ape.store](https://ape.store) launches on **Robinhood Chain** (internal chain id `4663`, an Arbitrum L2). Built with Next.js 14 (App Router) + Tailwind.

## Why this app is not previewable inside Replit

This Replit workspace's preview pane and one-click deploy only support its registered "artifact" types (`react-vite`, `expo`, `slides`, `video-js`, `openscad`). Next.js isn't one of them, so this app runs as a plain background workflow here — you can develop/inspect it via the shell (`curl http://localhost:5000`), but there's no visual preview inside Replit. It is fully functional code meant to be run and deployed outside Replit (Vercel, or any Node host).

## Local development (outside Replit, or via shell here)

```bash
pnpm install
pnpm --filter @workspace/token-screener run dev
# open http://localhost:5000
```

## Environment variables (server-side only, never exposed to the client)

| Variable | Purpose |
| --- | --- |
| `ALCHEMY_RPC` | Alchemy RPC endpoint for Robinhood Chain — used for future on-chain holder counts / wallet-funding trace (Phase 4+) |
| `SUPABASE_URL_PROJECT` | Supabase project URL — used starting Phase 3 (dev-wallet tracking) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key — server-only, never sent to the browser |

None of these are read yet by Phase 1 (the screener list works entirely off ape.store's public API), but they're already wired for the next phases.

## Supabase schema

Run `supabase/schema.sql` once in your Supabase project's SQL editor before starting Phase 3 (dev-wallet tracking / bundle detection). This repo has no way to execute DDL against Supabase directly — service-role key only grants REST access, not raw SQL.

## Deploying to Vercel

1. Import this GitHub repo into Vercel, with **Root Directory** set to `apps/token-screener`.
2. Add the three environment variables above in the Vercel project settings.
3. Deploy — no other config needed, this is a standard Next.js App Router project.

## ape.store API endpoints used (chain 4663)

- `GET /api/tokens?page=&sort=&order=&filter=&search=&chain=4663` — list/board (filter=0 is the only bucket returning live data)
- `GET /api/token/{chain}/{address}` — token detail
- `GET /api/token/{chain}/{address}/trades` — per-wallet trade history
- `GET /api/token/{chain}/{address}/holders` — exists but returns empty for this chain currently; holder counts need an Alchemy RPC fallback (not yet implemented)

## Roadmap

- **Phase 1 (done):** screener list — search, sort by market cap/volume/name, live 20s polling, EN/ID i18n, mobile-responsive.
- **Phase 2:** token detail page with polling auto-refresh.
- **Phase 3:** dev-wallet tracking (`wallet_launches` table) — warn when a creator has launched other tokens.
- **Phase 4:** wallet funding trace via Alchemy RPC (`wallet_transfers` table).
- **Phase 5:** bundle-wallet heuristic detection (`bundle_flags` table), shown as an indication, not a fact.
