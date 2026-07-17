import { NextRequest, NextResponse } from "next/server";
import { getEarlyBuyers, getEarliestIncomingTransfers } from "@/lib/alchemy";
import { isBridgeOrExchange, BRIDGE_FANOUT_THRESHOLD } from "@/lib/bridgeWhitelist";
import { getBundlerCache, setBundlerCache } from "@/lib/bundlerCache";

export const dynamic = "force-dynamic";

const MAX_BUYERS  = 30;
const CONCURRENCY = 5;
const CHAIN       = 4663;

// Inline eth_call for balanceOf — bypasses any workspace-package compilation
// quirk. Uses BigInt throughout to avoid float64 precision loss on 26-digit
// raw ERC-20 values. Returns hold % (0–100) with 4 decimal places, or -1 on error.
async function fetchHoldPct(tokenAddress: string, walletAddress: string): Promise<number> {
  const rpcUrl = process.env.ALCHEMY_RPC!;
  const selector = "0x70a08231"; // balanceOf(address)
  const padded   = walletAddress.toLowerCase().replace("0x", "").padStart(64, "0");

  try {
    const res  = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_call",
        params: [{ to: tokenAddress, data: selector + padded }, "latest"],
      }),
      cache: "no-store",
    });
    const body = await res.json() as { result?: string; error?: unknown };
    const hex  = body.result ?? "";
    if (!hex || hex === "0x") return 0;

    const raw = BigInt(hex);
    if (raw === 0n) return 0;

    // All ape.store tokens: 18 decimals, 1 000 000 000 total supply.
    // Compute basis-points first (avoids float), then convert to %.
    // pctBP = floor(raw * 1 000 000 / (1e9 * 1e18))  →  divide by 10 000 for %
    const DENOM = 1_000_000_000n * (10n ** 18n);          // total supply in raw units
    const bp    = (raw * 1_000_000n) / DENOM;              // basis-points × 100
    return Number(bp) / 10_000;                            // → percent, 4 dp precision
  } catch {
    return -1;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ chain: string; address: string }> },
) {
  const { address } = await params;

  if (!process.env.ALCHEMY_RPC) {
    return NextResponse.json({ error: "ALCHEMY_RPC not configured" }, { status: 503 });
  }

  try {
    // ── 1. Permanent cache for early buyers + funders (never changes) ─────────
    let earlyBuyers: string[];
    let funderMap: Record<string, string | null>;

    const cached = await getBundlerCache(CHAIN, address);

    if (cached) {
      earlyBuyers = cached.earlyBuyers;
      funderMap   = cached.funderMap;
    } else {
      earlyBuyers = await getEarlyBuyers(address, MAX_BUYERS);

      if (earlyBuyers.length === 0) {
        return NextResponse.json({ bundles: [], earlyBuyerCount: 0, fromCache: false });
      }

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

      funderMap = Object.fromEntries(withFunders.map(({ buyer, funder }) => [buyer, funder]));
      setBundlerCache(CHAIN, address, { earlyBuyers, funderMap }); // fire-and-forget
    }

    // ── 2. Group by shared funder ─────────────────────────────────────────────
    const byFunder: Record<string, string[]> = {};
    for (const [buyer, funder] of Object.entries(funderMap)) {
      if (!funder) continue;
      (byFunder[funder] ??= []).push(buyer);
    }

    // ── 3. Live balance check — pure BigInt, always fresh ─────────────────────
    const bundles: {
      funder: string;
      buyers: { address: string; status: "holding" | "sold"; holdPct: number }[];
      suppressed: boolean;
    }[] = [];

    for (const [funder, buyers] of Object.entries(byFunder)) {
      if (buyers.length < 2) continue;

      const suppressed = isBridgeOrExchange(
        funder,
        buyers.length >= BRIDGE_FANOUT_THRESHOLD ? buyers.length : 0,
      );

      const buyersWithStatus = await Promise.all(
        buyers.map(async (buyer) => {
          const holdPct = await fetchHoldPct(address, buyer);
          const status: "holding" | "sold" = holdPct <= 0 ? "sold" : "holding";
          return { address: buyer, status, holdPct: holdPct > 0 ? holdPct : 0 };
        }),
      );

      bundles.push({ funder, buyers: buyersWithStatus, suppressed });
    }

    const visibleBundles  = bundles.filter((b) => !b.suppressed);
    const suppressedCount = bundles.length - visibleBundles.length;

    return NextResponse.json({
      bundles: visibleBundles,
      suppressedCount,
      earlyBuyerCount: earlyBuyers.length,
      fromCache: !!cached,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
