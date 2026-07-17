// Permanent Supabase cache for bundler early-buyer data.
// Early buyers and their funders are immutable once written — the first 30
// buyers of a token never change. Caching them avoids ~31 Alchemy calls
// (1 getEarlyBuyers + 30 getEarliestIncomingTransfers) on every re-check.
// Token balances (hold %) are NOT cached here — they must always be live.

import { getSupabaseAdmin } from "@/lib/supabase";

export interface BundlerCacheEntry {
  earlyBuyers: string[];
  funderMap: Record<string, string | null>; // buyer_address → funder_address | null
}

export async function getBundlerCache(
  chain: number,
  tokenAddress: string,
): Promise<BundlerCacheEntry | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("bundler_cache")
    .select("early_buyers, funder_map")
    .eq("chain", chain)
    .eq("token_address", tokenAddress.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("[bundlerCache] read failed:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    earlyBuyers: data.early_buyers as string[],
    funderMap: data.funder_map as Record<string, string | null>,
  };
}

export async function setBundlerCache(
  chain: number,
  tokenAddress: string,
  entry: BundlerCacheEntry,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const { error } = await supabase.from("bundler_cache").upsert(
    {
      chain,
      token_address: tokenAddress.toLowerCase(),
      early_buyers: entry.earlyBuyers,
      funder_map: entry.funderMap,
    },
    { onConflict: "chain,token_address" },
  );

  if (error) console.error("[bundlerCache] write failed:", error.message);
}
