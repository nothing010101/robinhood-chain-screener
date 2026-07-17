import { NextRequest, NextResponse } from "next/server";
import { ROBINHOOD_CHAIN_ID } from "@/lib/apestore";
import { getFundingTrace, getFunderFanOut } from "@/lib/walletTransfers";
import { isBridgeOrExchange } from "@/lib/bridgeWhitelist";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Phase 4: wallet funding trace. Returns the earliest known funder of this
// wallet plus how many other dev wallets that same funder has funded.
export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } },
) {
  if (!params.address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  try {
    const trace = await getFundingTrace(ROBINHOOD_CHAIN_ID, params.address);
    if (!trace) {
      return NextResponse.json({ trace: null, funderFanOut: 0 });
    }
    const funderFanOut = await getFunderFanOut(ROBINHOOD_CHAIN_ID, trace.from_address);
    const funderSuppressed = isBridgeOrExchange(trace.from_address, funderFanOut);
    return NextResponse.json({ trace, funderFanOut, funderSuppressed });
  } catch (err) {
    console.error("[/api/wallet/:address/funding]", err);
    return NextResponse.json(
      { error: "Failed to trace wallet funding", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
