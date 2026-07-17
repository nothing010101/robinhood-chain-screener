import { NextRequest, NextResponse } from "next/server";
import { fetchTokenDetail } from "@/lib/apestore";
import { recordTokenLaunches } from "@/lib/walletLaunches";
import { getCachedHolderCounts, type TokenHolderRow } from "@/lib/tokenHolders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: { chain: string; address: string } },
) {
  const chain = Number(params.chain);
  if (!Number.isFinite(chain) || !params.address) {
    return NextResponse.json({ error: "Invalid chain or address" }, { status: 400 });
  }

  try {
    const data = await fetchTokenDetail(chain, params.address);
    // Best-effort: record this launch too, in case it's a dead/delisted token
    // missing from the live list bucket.
    recordTokenLaunches([data.token]).catch((err) =>
      console.error("[/api/token/:chain/:address] recordTokenLaunches", err),
    );

    // Same Alchemy-derived Supabase cache as /api/tokens — never computed
    // live here.
    const holderCounts: Record<string, TokenHolderRow> = await getCachedHolderCounts(chain, [
      data.token.address,
    ]).catch((err) => {
      console.error("[/api/token/:chain/:address] getCachedHolderCounts", err);
      return {};
    });
    const holderCount = holderCounts[data.token.address.toLowerCase()]?.holder_count ?? null;
    const holderUpdatedAt = holderCounts[data.token.address.toLowerCase()]?.computed_at ?? null;

    return NextResponse.json({ ...data, token: { ...data.token, holderCount, holderUpdatedAt } });
  } catch (err) {
    console.error("[/api/token/:chain/:address]", err);
    return NextResponse.json(
      { error: "Failed to load token detail from ape.store", detail: (err as Error).message },
      { status: 502 },
    );
  }
}
