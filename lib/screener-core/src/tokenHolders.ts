// Holder-count cache backed by Supabase's `token_holders` table.
//
// ape.store's own `holders` field is always 0 on Robinhood Chain, so we
// derive the real count ourselves via Alchemy (see computeTokenHolderCount in
// alchemy.ts) — but that's a full-history on-chain scan per token, far too
// slow/expensive to run on every page load. Instead the worker refreshes this
// cache on a slow interval, and both the worker and the Next.js app read from
// it through this shared module.

import { getSupabaseAdmin } from "./supabase";

export interface TokenHolderRow {
  chain: number;
  token_address: string;
  holder_count: number;
  computed_at: string;
}

export async function getCachedHolderCounts(
  chain: number,
  addresses: string[],
): Promise<Record<string, TokenHolderRow>> {
  const supabase = getSupabaseAdmin();
  const unique = Array.from(new Set(addresses.map((a) => a.toLowerCase())));
  if (!supabase || unique.length === 0) return {};

  const { data, error } = await supabase
    .from("token_holders")
    .select("*")
    .eq("chain", chain)
    .in("token_address", unique);

  if (error) {
    console.error("[tokenHolders] cache read failed:", error.message);
    return {};
  }

  const out: Record<string, TokenHolderRow> = {};
  for (const row of data ?? []) {
    out[row.token_address] = row;
  }
  return out;
}

export async function upsertHolderCount(chain: number, tokenAddress: string, holderCount: number): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase.from("token_holders").upsert(
    {
      chain,
      token_address: tokenAddress.toLowerCase(),
      holder_count: holderCount,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "chain,token_address" },
  );
  if (error) console.error("[tokenHolders] upsert failed:", error.message);
}

// Rows whose cache is missing entirely or older than `maxAgeMs` — the set the
// worker should recompute this cycle.
export function selectStaleAddresses(
  addresses: string[],
  cached: Record<string, TokenHolderRow>,
  maxAgeMs: number,
): string[] {
  const now = Date.now();
  return Array.from(new Set(addresses.map((a) => a.toLowerCase()))).filter((address) => {
    const row = cached[address];
    if (!row) return true;
    return now - new Date(row.computed_at).getTime() > maxAgeMs;
  });
}
