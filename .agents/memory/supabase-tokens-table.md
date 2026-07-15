---
name: Supabase tokens table
description: Schema, query pattern, and row-cap workaround for the tokens table added to replace ape.store frontend pagination.
---

## Schema
Table `public.tokens` (chain, address PRIMARY KEY). Key columns: market_cap, volume_usd, deploy_date, price, price_1h, price_24h, logo, twitter, telegram, website, dex_paid, is_king, is_dead, chat_count, last_seen_at.

Partial indexes (WHERE is_dead = false): idx_tokens_market_cap, idx_tokens_volume_usd, idx_tokens_deploy_date, idx_tokens_name.

## Row-cap workaround
Supabase free tier has a server-side `max-rows = 1000` cap that cannot be overridden by `limit` or `Range` headers. Workaround: paginate with Range headers (Range: 0-999, 1000-1999, ...) in parallel. Implemented in `getLiveTokens()` in `lib/screener-core/src/tokenData.ts`.

**Why:** supabase-js `.limit(10000)` is silently capped at 1000. The Range header approach also hits the cap. Only parallel pagination works.

## getLiveTokens uses fetch() not supabase-js
`getLiveTokens` uses raw `fetch()` to the Supabase REST API directly — NOT the supabase-js client. This was necessary because supabase-js had a module-singleton / Vercel bundling issue causing the client to silently return [] in production even when env vars were set.

**Why:** supabase-js `getSupabaseAdmin()` module-level cache + Vercel serverless bundling = silent empty responses. Direct REST fetch always works.

## Backfill
Worker startup: `isTokenTableStale()` checks if newest `last_seen_at` is older than `STARTUP_STALE_THRESHOLD_MS` (default 5 min). If stale → logs warning, then `pollOnce()` runs immediately. `pollOnce()` always runs on startup regardless.

Manual seed script: `scripts/seed-tokens.mjs` (run from `lib/screener-core/` context with `node --input-type=module`). Uses numeric ape.store sort params: `sort=0&order=0`.

## ape.store API params
Numeric, not string: `sort=0&order=0` for marketCap desc. `sort=marketCap&order=desc` returns 400 error.

## Sort architecture
All sorting is client-side JS in `useMemo`. Fetch is done once (no sort param sent). Sort switch = <5ms, no network. Re-fetch every 30s for freshness. Server-side ORDER BY was tried but caused 1.3-3.9s per sort change — reverted.
