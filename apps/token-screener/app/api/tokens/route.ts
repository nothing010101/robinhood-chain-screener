import { NextRequest, NextResponse } from "next/server";
import { fetchTokenList, ROBINHOOD_CHAIN_ID } from "@/lib/apestore";
import { recordTokenLaunches } from "@/lib/walletLaunches";
import { getCachedHolderCounts, type TokenHolderRow } from "@/lib/tokenHolders";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const search = searchParams.get("search") ?? "";

  try {
    const data = await fetchTokenList({ page, search, chain: ROBINHOOD_CHAIN_ID });
    // Best-effort, non-blocking: build up dev-wallet launch history for Phase 3.
    recordTokenLaunches(data.items).catch((err) => console.error("[/api/tokens] recordTokenLaunches", err));

    // Holder counts come from a Supabase cache the worker refreshes on a slow
    // interval (see apps/worker) — never computed live here, since deriving
    // them from Alchemy is a full on-chain history scan per token.
    const holderCounts: Record<string, TokenHolderRow> = await getCachedHolderCounts(
      ROBINHOOD_CHAIN_ID,
      data.items.map((item) => item.address),
    ).catch((err) => {
      console.error("[/api/tokens] getCachedHolderCounts", err);
      return {};
    });
    const items = data.items.map((item) => ({
      ...item,
      holderCount: holderCounts[item.address.toLowerCase()]?.holder_count ?? null,
      holderUpdatedAt: holderCounts[item.address.toLowerCase()]?.computed_at ?? null,
    }));

    return NextResponse.json({ ...data, items });
  } catch (err) {
    console.error("[/api/tokens]", err);
    return NextResponse.json(
      { error: "Failed to load tokens from ape.store", detail: (err as Error).message },
      { status: 502 },
    );
  }
}
