import { NextRequest, NextResponse } from "next/server";
import { ROBINHOOD_CHAIN_ID } from "@/lib/apestore";
import { getLaunchesByCreator } from "@/lib/walletLaunches";

export const dynamic = "force-dynamic";

// Returns up to 50 launches for this creator, newest first.
// Supports cursor-based pagination via ?cursor=<ISO deploy_date>.
// Response: { creator, launches, hasMore, nextCursor }
export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } },
) {
  if (!params.address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;

  try {
    const { launches, hasMore, nextCursor } = await getLaunchesByCreator(
      ROBINHOOD_CHAIN_ID,
      params.address,
      cursor,
    );
    return NextResponse.json({
      creator: params.address.toLowerCase(),
      launches,
      hasMore,
      nextCursor,
    });
  } catch (err) {
    console.error("[/api/wallet/:address/launches]", err);
    return NextResponse.json(
      { error: "Failed to load wallet launch history", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
