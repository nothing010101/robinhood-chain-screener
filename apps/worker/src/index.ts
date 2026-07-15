// Standalone dev-wallet tracking worker.
//
// The Next.js app only calls recordTokenLaunches() when a browser has the
// screener page open (it happens inside the /api/tokens route handler, which
// only runs on incoming requests). That means wallet_launches history has
// gaps whenever nobody is looking at the site.
//
// This process closes that gap: it runs continuously on its own (deployed as
// a long-running Railway service, not a serverless function) and polls
// ape.store directly on a fixed interval, independent of any user traffic.
// It shares the exact same recordTokenLaunches() implementation from
// @workspace/screener-core — no duplicated upsert logic.

import {
  fetchAllLiveTokens,
  recordTokenLaunches,
  ROBINHOOD_CHAIN_ID,
  computeTokenHolderCount,
  getCachedHolderCounts,
  upsertHolderCount,
  selectStaleAddresses,
} from "@workspace/screener-core";

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 30_000);

// Holder counts require a full on-chain Transfer-history scan per token via
// Alchemy — far too slow/expensive to do on every 30s poll. Refresh on a much
// slower cadence instead, and only for addresses whose cached value is
// missing or older than the refresh interval itself.
const HOLDER_REFRESH_INTERVAL_MS = Number(process.env.HOLDER_REFRESH_INTERVAL_MS ?? 5 * 60_000);
// Cap how many tokens get a holder-count recompute per cycle so a sudden
// burst of new launches can't turn one tick into hundreds of Alchemy calls.
const HOLDER_REFRESH_BATCH_SIZE = Number(process.env.HOLDER_REFRESH_BATCH_SIZE ?? 20);

let stopping = false;
let inFlight = false;
let latestLiveAddresses: string[] = [];
let holderRefreshInFlight = false;

async function pollOnce(): Promise<void> {
  if (inFlight) {
    // Guard against overlapping runs if ape.store is slow to respond and the
    // interval fires again before the previous poll finished.
    console.warn("[worker] previous poll still running, skipping this tick");
    return;
  }
  inFlight = true;
  const startedAt = Date.now();
  try {
    const items = await fetchAllLiveTokens(ROBINHOOD_CHAIN_ID);
    await recordTokenLaunches(items);
    latestLiveAddresses = items.map((item) => item.address);
    console.log(
      `[worker] polled ${items.length} live tokens on chain ${ROBINHOOD_CHAIN_ID} in ${Date.now() - startedAt}ms`,
    );
  } catch (err) {
    // A single failed poll must never crash the process — just log and let
    // the next tick retry.
    console.error("[worker] poll failed:", (err as Error).message);
  } finally {
    inFlight = false;
  }
}

async function refreshHolderCountsOnce(): Promise<void> {
  if (holderRefreshInFlight) {
    console.warn("[worker] previous holder-count refresh still running, skipping this tick");
    return;
  }
  if (!process.env.ALCHEMY_RPC) {
    // Not configured — skip silently rather than spamming errors every cycle.
    return;
  }
  if (latestLiveAddresses.length === 0) return;

  holderRefreshInFlight = true;
  const startedAt = Date.now();
  try {
    const cached = await getCachedHolderCounts(ROBINHOOD_CHAIN_ID, latestLiveAddresses);
    const stale = selectStaleAddresses(latestLiveAddresses, cached, HOLDER_REFRESH_INTERVAL_MS).slice(
      0,
      HOLDER_REFRESH_BATCH_SIZE,
    );
    if (stale.length === 0) return;

    let ok = 0;
    for (const address of stale) {
      try {
        const holderCount = await computeTokenHolderCount(address);
        await upsertHolderCount(ROBINHOOD_CHAIN_ID, address, holderCount);
        ok++;
      } catch (err) {
        console.error(`[worker] holder-count refresh failed for ${address}:`, (err as Error).message);
      }
    }
    console.log(
      `[worker] refreshed holder counts for ${ok}/${stale.length} tokens in ${Date.now() - startedAt}ms`,
    );
  } catch (err) {
    console.error("[worker] holder-count refresh cycle failed:", (err as Error).message);
  } finally {
    holderRefreshInFlight = false;
  }
}

async function main() {
  console.log(`[worker] starting — polling ape.store every ${POLL_INTERVAL_MS}ms`);

  // Optional health-check server: only bound if Railway (or any host) injects
  // a PORT. The worker's real job needs no inbound traffic, but some hosting
  // setups expect a port to open before treating a service as healthy.
  const rawPort = process.env.PORT;
  if (rawPort) {
    const { createServer } = await import("node:http");
    const port = Number(rawPort);
    createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
    }).listen(port, () => console.log(`[worker] health check server listening on ${port}`));
  }

  await pollOnce();
  const timer = setInterval(() => {
    if (!stopping) void pollOnce();
  }, POLL_INTERVAL_MS);

  const holderTimer = setInterval(() => {
    if (!stopping) void refreshHolderCountsOnce();
  }, HOLDER_REFRESH_INTERVAL_MS);
  // Kick off an initial refresh shortly after the first poll populates
  // latestLiveAddresses, rather than waiting a full interval.
  setTimeout(() => void refreshHolderCountsOnce(), 15_000);

  const shutdown = (signal: string) => {
    console.log(`[worker] received ${signal}, shutting down`);
    stopping = true;
    clearInterval(timer);
    clearInterval(holderTimer);
    process.exit(0);
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[worker] fatal startup error:", err);
  process.exit(1);
});
