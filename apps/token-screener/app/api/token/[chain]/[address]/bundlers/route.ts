import { NextRequest, NextResponse } from "next/server";
import { getEarlyBuyers, getEarliestIncomingTransfers, getTokenBalance } from "@/lib/alchemy";
import { isBridgeOrExchange, BRIDGE_FANOUT_THRESHOLD } from "@/lib/bridgeWhitelist";

export const dynamic = "force-dynamic";

const MAX_BUYERS   = 30;
const CONCURRENCY  = 5;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chain: string; address: string }> },
) {
  const { address } = await params;

  if (!process.env.ALCHEMY_RPC) {
    return NextResponse.json({ error: "ALCHEMY_RPC not configured" }, { status: 503 });
  }

  try {
    const earlyBuyers = await getEarlyBuyers(address, MAX_BUYERS);

    if (earlyBuyers.length === 0) {
      return NextResponse.json({ bundles: [], earlyBuyerCount: 0 });
    }

    // Fetch the earliest ETH funder for each early buyer, in batches.
    const withFunders: { buyer: string; funder: string | null }[] = [];
    for (let i = 0; i < earlyBuyers.length; i += CONCURRENCY) {
      const batch = earlyBuyers.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (buyer) => {
          const transfers = await getEarliestIncomingTransfers(buyer, 1).catch(() => []);
          return { buyer, funder: transfers[0]?.from?.toLowerCase() ?? null };
        }),
      );
      withFunders.push(...results);
    }

    // Group buyers by shared funder, skip bridge/exchange funders.
    const byFunder: Record<string, string[]> = {};
    const funderFanOut: Record<string, number> = {};
    for (const { buyer, funder } of withFunders) {
      if (!funder) continue;
      (byFunder[funder] ??= []).push(buyer);
    }

    // Estimate fan-out from this response (how many buyers share this funder).
    // Full Supabase fan-out check is skipped here to keep latency low — the
    // local count gives a good-enough signal for bridge detection.
    const bundles: {
      funder: string;
      buyers: { address: string; status: "holding" | "sold" }[];
      suppressed: boolean;
    }[] = [];

    for (const [funder, buyers] of Object.entries(byFunder)) {
      if (buyers.length < 2) continue;

      const localFanOut = buyers.length;
      funderFanOut[funder] = localFanOut;
      const suppressed = isBridgeOrExchange(funder, localFanOut >= BRIDGE_FANOUT_THRESHOLD ? localFanOut : 0);

      // Check sell/hold status for each bundler wallet — only on click, cheap eth_call.
      const buyersWithStatus = await Promise.all(
        buyers.map(async (buyer) => {
          const balance = await getTokenBalance(address, buyer).catch(() => -1);
          const status: "holding" | "sold" = balance === 0 ? "sold" : "holding";
          return { address: buyer, status };
        }),
      );

      bundles.push({ funder, buyers: buyersWithStatus, suppressed });
    }

    const visibleBundles = bundles.filter((b) => !b.suppressed);
    const suppressedCount = bundles.length - visibleBundles.length;

    return NextResponse.json({
      bundles: visibleBundles,
      suppressedCount,
      earlyBuyerCount: earlyBuyers.length,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
