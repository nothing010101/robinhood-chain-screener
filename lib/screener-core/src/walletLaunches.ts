// Phase 3: dev-wallet tracking.
//
// Every time we fetch tokens from ape.store (list or detail), we upsert a row
// per token into `wallet_launches` keyed on (chain, token_address). Over time
// this builds a history of which wallets ("devs") have launched which tokens,
// so we can warn when a token's creator has launched others on Robinhood Chain.
//
// This is best-effort: if Supabase isn't configured or a write fails, we log
// and move on — dev-wallet tracking must never break the core screener.
//
// Called from two independent places: the Next.js app's `/api/tokens` route
// (only while a browser tab has the screener open) and the standalone worker
// in apps/worker (polls continuously regardless of traffic). Both go through
// this single implementation so there is one source of truth for the upsert
// logic.

import { getSupabaseAdmin } from "./supabase";
import type { ApeStoreTokenListItem } from "./apestore";

export interface WalletLaunch {
  chain: number;
  creator_address: string;
  token_address: string;
  token_name: string | null;
  token_symbol: string | null;
  deploy_date: string | null;
  created_at: string;
}

export async function recordTokenLaunches(items: ApeStoreTokenListItem[]): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase || items.length === 0) return;

  const rows = items
    .filter((item) => !!item.creator && !!item.address)
    .map((item) => ({
      chain: item.chain,
      creator_address: item.creator.toLowerCase(),
      token_address: item.address.toLowerCase(),
      token_name: item.name,
      token_symbol: item.symbol,
      deploy_date: item.deployDate ?? item.createDate ?? null,
    }));
  if (rows.length === 0) return;

  const { error } = await supabase.from("wallet_launches").upsert(rows, { onConflict: "chain,token_address" });
  if (error) console.error("[walletLaunches] upsert failed:", error.message);
}

const PAGE_SIZE = 50;

export interface LaunchesByCreatorResult {
  launches: WalletLaunch[];
  /** True when exactly PAGE_SIZE rows were returned, meaning more pages likely exist. */
  hasMore: boolean;
  /**
   * ISO deploy_date of the last row — pass as `cursor` in the next call.
   * Null when there are no more pages (last row has null deploy_date or fewer
   * than PAGE_SIZE rows were returned).
   */
  nextCursor: string | null;
}

/**
 * Fetch up to PAGE_SIZE (50) launches for a creator, newest first.
 *
 * Pass `cursor` (the `nextCursor` from a previous response) to get the next
 * page.  Uses Supabase REST directly (same as getLiveTokens) to avoid
 * supabase-js module-singleton issues in Vercel serverless.
 */
export async function getLaunchesByCreator(
  chain: number,
  creatorAddress: string,
  cursor?: string,
): Promise<LaunchesByCreatorResult> {
  const url = process.env.SUPABASE_URL_PROJECT ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.error("[walletLaunches] SUPABASE_URL_PROJECT / SUPABASE_SERVICE_ROLE_KEY not set");
    return { launches: [], hasMore: false, nextCursor: null };
  }

  const params = new URLSearchParams({
    chain:           `eq.${chain}`,
    creator_address: `eq.${creatorAddress.toLowerCase()}`,
    order:           "deploy_date.desc.nullslast",
    limit:           String(PAGE_SIZE),
    select:          "*",
  });

  // Cursor-based pagination: fetch rows whose deploy_date is strictly before
  // the cursor value so we never re-send already-seen rows.
  if (cursor) {
    params.set("deploy_date", `lt.${cursor}`);
  }

  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/wallet_launches?${params.toString()}`;

  let rows: WalletLaunch[];
  try {
    const res = await fetch(endpoint, {
      headers: {
        apikey:        key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[walletLaunches] getLaunchesByCreator HTTP ${res.status}:`, body);
      return { launches: [], hasMore: false, nextCursor: null };
    }
    rows = (await res.json() as WalletLaunch[]) ?? [];
  } catch (err) {
    console.error("[walletLaunches] getLaunchesByCreator fetch error:", err);
    return { launches: [], hasMore: false, nextCursor: null };
  }

  // If we received a full page there might be more rows.  The next cursor is
  // the deploy_date of the last row; if that's null we can't paginate further.
  const hasMore = rows.length === PAGE_SIZE;
  const lastRow = rows[rows.length - 1];
  const nextCursor = hasMore && lastRow?.deploy_date ? lastRow.deploy_date : null;

  return { launches: rows, hasMore: !!nextCursor, nextCursor };
}

// Batched lookup for the list view: given a set of creator addresses, return
// how many distinct tokens each has launched on this chain (per our recorded
// history — a lower bound, since we only know what we've observed).
export async function getLaunchCountsByCreators(
  chain: number,
  creatorAddresses: string[],
): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin();
  const unique = Array.from(new Set(creatorAddresses.map((a) => a.toLowerCase())));
  if (!supabase || unique.length === 0) return {};

  const { data, error } = await supabase
    .from("wallet_launches")
    .select("creator_address, token_address")
    .eq("chain", chain)
    .in("creator_address", unique);

  if (error) {
    console.error("[walletLaunches] query counts failed:", error.message);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.creator_address] = (counts[row.creator_address] ?? 0) + 1;
  }
  return counts;
}
