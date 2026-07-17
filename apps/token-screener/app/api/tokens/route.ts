import { NextResponse } from "next/server";
import { fetchAllLiveTokens, ROBINHOOD_CHAIN_ID } from "@/lib/apestore";

export const dynamic = "force-dynamic";
// Vercel Pro max — fetchAllLiveTokens can take 20-30s on a large chain
export const maxDuration = 60;

const MIN_MC = 7_000;

// Fetch ALL live tokens from ape.store (concurrency=20, ~7s), filter MC >= $7K,
// sort by MC desc. Tokens below $7K are only findable via CA search.
export async function GET() {
  try {
    const tokens = await fetchAllLiveTokens(ROBINHOOD_CHAIN_ID, 20);

    const result = tokens
      .filter((t) => !t.isDead && t.marketCap >= MIN_MC)
      .sort((a, b) => b.marketCap - a.marketCap);

    return NextResponse.json({ items: result, total: result.length });
  } catch (err) {
    console.error("[/api/tokens]", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
