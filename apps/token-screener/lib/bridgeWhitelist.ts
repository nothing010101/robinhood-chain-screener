// Known bridge / infrastructure addresses on Robinhood Chain (4663).
// Wallets funded from these addresses should NOT be flagged as coordinated —
// they are shared intermediaries used by many unrelated users.
//
// Add new entries as bridges expand Robinhood Chain support.
// All addresses lowercase.

export const BRIDGE_WHITELIST = new Set<string>([
  // Confirmed bridge/relay addresses on Robinhood Chain (4663).
  // Criteria: 250+ total outgoing transactions to many unique recipients.
  // User-confirmed:
  "0x56c262027e0de4aea31d2489529cb25d23e58a8b", // Relay / Coinbase bridge (user confirmed)
  // High-volume relayers (250+ txs, confirmed via Blockscout):
  "0xa67d7eb4dc68fa6ce8e34ef8cadaf075b9893fbb",
  "0xada5bb90d0de0bd1b6f3938708f49295a8d1f7cb",
  "0xabb2acd3be814a80e502575d6c1dc5f789e9cd10",
  // Legacy placeholder entries (unconfirmed — keep until verified)
  "0x1a2b9ef49d1cd4a24dc88f014d74fceada585efa",
  "0xa5f565650890fba1824ee0f21ebbbf660a179934",
  "0x4d9b5c9c55e47b32b0a2c08e5d6e7f0f1a2b4c6e",
]);

// Fan-out threshold: a funder that has initialised this many or more distinct
// wallets is almost certainly a bridge/relayer, not a coordinated dev operator.
export const BRIDGE_FANOUT_THRESHOLD = 30;

export function isBridgeOrExchange(address: string, fanOut: number): boolean {
  return BRIDGE_WHITELIST.has(address.toLowerCase()) || fanOut >= BRIDGE_FANOUT_THRESHOLD;
}
