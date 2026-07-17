import { NextRequest, NextResponse } from "next/server";
import { getLaunchCountsByCreators } from "@workspace/screener-core/walletLaunches";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BLOCKSCOUT = "https://robinhoodchain.blockscout.com";
const CHAIN = 4663;
// 1e9 tokens × 1e18 decimals — BigInt() ctor for ES2017 compat
const TOTAL_SUPPLY_RAW = BigInt("1000000000000000000000000000");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chain: string; address: string }> },
) {
  const { address } = await params;

  try {
    const res = await fetch(
      `${BLOCKSCOUT}/api?module=token&action=getTokenHolders&contractaddress=${address}&page=1&offset=50`,
      { cache: "no-store" },
    );
    const body = (await res.json()) as { status: string; result?: { address: string; value: string }[] };

    if (body.status !== "1" || !Array.isArray(body.result)) {
      return NextResponse.json({ holders: [], total: 0 });
    }

    const rawHolders = body.result;

    // Compute hold % with BigInt — same precision trick as bundlers route
    const holders = rawHolders.map((h) => {
      const raw = BigInt(h.value);
      const bp  = (raw * BigInt("1000000")) / TOTAL_SUPPLY_RAW;
      return { address: h.address.toLowerCase(), holdPct: Number(bp) / 10000 };
    });

    // Check which holders have launched tokens before (dev wallet detection)
    const addrs = holders.map((h) => h.address);
    const launchCounts = await getLaunchCountsByCreators(CHAIN, addrs);

    const result = holders.map((h) => ({
      address:     h.address,
      holdPct:     h.holdPct,
      launchCount: launchCounts[h.address] ?? 0,
      isDevWallet: (launchCounts[h.address] ?? 0) > 0,
    }));

    return NextResponse.json({ holders: result, total: result.length });
  } catch (err) {
    console.error("[/api/token/:chain/:address/holders]", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
