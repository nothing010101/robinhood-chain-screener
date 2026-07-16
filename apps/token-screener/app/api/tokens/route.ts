import { NextRequest, NextResponse } from "next/server";
import { fetchAllLiveTokens, ROBINHOOD_CHAIN_ID } from "@/lib/apestore";

export const dynamic = "force-dynamic";

// Holder counts from Supabase (small table, rarely changes).
interface HolderRow { token_address: string; holder_count: number; computed_at: string; }

async function getHolderCounts(): Promise<Map<string, HolderRow>> {
  const url = process.env.SUPABASE_URL_PROJECT ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) return new Map();
  const res = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/token_holders?chain=eq.${ROBINHOOD_CHAIN_ID}&select=token_address,holder_count,computed_at`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
  );
  if (!res.ok) return new Map();
  const rows: HolderRow[] = await res.json();
  const map = new Map<string, HolderRow>();
  for (const r of rows) map.set(r.token_address.toLowerCase(), r);
  return map;
}

// Fetch ALL live tokens directly from ape.store with high concurrency.
// concurrency=20 → ~130 pages / 20 = ~7 batches → completes in ~7s.
// No Supabase, no cache — always live.
export async function GET(req: NextRequest) {
  const mode = new URL(req.url).searchParams.get("mode") === "mc" ? "mc" : "new";

  try {
    const [tokens, holderMap] = await Promise.all([
      fetchAllLiveTokens(ROBINHOOD_CHAIN_ID, 20),
      getHolderCounts(),
    ]);

    const live = tokens
      .filter((t) => !t.isDead)
      .map((t) => {
        const h = holderMap.get(t.address.toLowerCase());
        return { ...t, holderCount: h?.holder_count ?? null, holderUpdatedAt: h?.computed_at ?? null };
      });

    let result;
    if (mode === "new") {
      result = [...live]
        .sort((a, b) => new Date(b.deployDate).getTime() - new Date(a.deployDate).getTime())
        .slice(0, 50);
    } else {
      result = [...live]
        .filter((t) => t.marketCap >= 5_000)
        .sort((a, b) => b.marketCap - a.marketCap);
    }

    return NextResponse.json({ items: result, total: result.length, mode });
  } catch (err) {
    console.error("[/api/tokens]", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
