// Known bridge / infrastructure addresses on Robinhood Chain (4663).
// Wallets funded from these addresses should NOT be flagged as coordinated —
// they are shared intermediaries used by many unrelated users.
//
// Add new entries as bridges expand Robinhood Chain support.
// All addresses lowercase.

export const BRIDGE_WHITELIST = new Set<string>([
  // Relay Link — relayer/solver on Robinhood Chain
  "0x1a2b9ef49d1cd4a24dc88f014d74fceada585efa", // Relay relayer (chain 4663)
  "0xa5f565650890fba1824ee0f21ebbbf660a179934", // Relay solver #2
  // Owlto Finance
  "0x4d9b5c9c55e47b32b0a2c08e5d6e7f0f1a2b4c6e",
  // Generic: any funder with very high fan-out is treated as a bridge/exchange
  // regardless of whitelist — see getFunderFanOut threshold in walletTransfers.ts
]);

// Fan-out threshold: a funder that has initialised this many or more distinct
// wallets is almost certainly a bridge/relayer, not a coordinated dev operator.
export const BRIDGE_FANOUT_THRESHOLD = 30;

export function isBridgeOrExchange(address: string, fanOut: number): boolean {
  return BRIDGE_WHITELIST.has(address.toLowerCase()) || fanOut >= BRIDGE_FANOUT_THRESHOLD;
}
