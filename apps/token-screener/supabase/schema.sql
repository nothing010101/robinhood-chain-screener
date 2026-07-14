-- Robinhood Chain Screener — Supabase schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor) before Phase 3.
-- Service-role key + project URL are already configured as Replit secrets;
-- this repo has no way to run DDL against Supabase directly, so apply it manually.

create table if not exists wallet_launches (
  id bigint generated always as identity primary key,
  chain integer not null default 4663,
  creator_address text not null,
  token_address text not null,
  token_name text,
  token_symbol text,
  deploy_date timestamptz,
  created_at timestamptz not null default now(),
  unique (chain, token_address)
);
create index if not exists idx_wallet_launches_creator on wallet_launches (creator_address);

create table if not exists wallet_transfers (
  id bigint generated always as identity primary key,
  chain integer not null default 4663,
  from_address text not null,
  to_address text not null,
  tx_hash text not null,
  amount numeric,
  timestamp timestamptz,
  created_at timestamptz not null default now(),
  unique (chain, tx_hash, from_address, to_address)
);
create index if not exists idx_wallet_transfers_to on wallet_transfers (to_address);
create index if not exists idx_wallet_transfers_from on wallet_transfers (from_address);

create table if not exists bundle_flags (
  id bigint generated always as identity primary key,
  chain integer not null default 4663,
  wallet_a text not null,
  wallet_b text not null,
  evidence_tx text,
  confidence_note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_bundle_flags_wallets on bundle_flags (wallet_a, wallet_b);
