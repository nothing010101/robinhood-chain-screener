// One-time script: fetch all live tokens from ape.store and upsert into
// the Supabase `tokens` table so the screener has data before the
// Railway worker redeploys with the new upsertTokenSnapshot() call.
//
// Run from workspace root:  node scripts/seed-tokens.mjs

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.SUPABASE_URL_PROJECT;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHAIN         = 4663;
const APESTORE_BASE = "https://ape.store";
const PAGE_SIZE     = 24;
const TOTAL_SUPPLY  = 1_000_000_000;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL_PROJECT or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchPage(page) {
  const url = `${APESTORE_BASE}/api/tokens?chain=${CHAIN}&page=${page}&sort=marketCap&order=desc`;
  const res = await fetch(url, { headers: { "User-Agent": "apescreener-seed/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);
  const data = await res.json();
  return data.items ?? [];
}

async function fetchAllTokens() {
  const all = [];
  let page = 1;
  while (true) {
    const items = await fetchPage(page);
    all.push(...items);
    console.log(`  page ${page}: ${items.length} items (total so far: ${all.length})`);
    if (items.length < PAGE_SIZE) break;
    page++;
    await new Promise(r => setTimeout(r, 100)); // polite delay
  }
  return all;
}

function itemToRow(t, now) {
  return {
    chain:        CHAIN,
    address:      t.address.toLowerCase(),
    name:         t.name,
    symbol:       t.symbol,
    creator:      t.creator.toLowerCase(),
    market_cap:   t.marketCap ?? null,
    volume_usd:   t.volumeStat?.volumeUSD ?? null,
    deploy_date:  t.deployDate ?? null,
    price:        t.marketCap != null ? t.marketCap / TOTAL_SUPPLY : null,
    price_1h:     t.price1H  != null ? parseFloat(t.price1H)  : null,
    price_24h:    t.price24H != null ? parseFloat(t.price24H) : null,
    logo:         t.logo     ?? null,
    twitter:      t.twitter  ?? null,
    telegram:     t.telegram ?? null,
    website:      t.website  ?? null,
    dex_paid:     t.dexPaid  ?? false,
    is_king:      t.isKing   ?? false,
    is_dead:      t.isDead   ?? false,
    chat_count:   t.chatCount ?? 0,
    last_seen_at: now,
  };
}

async function main() {
  console.log("Fetching all tokens from ape.store…");
  const items = await fetchAllTokens();
  console.log(`\nFetched ${items.length} tokens. Upserting to Supabase…`);

  const now = new Date().toISOString();
  const rows = items.map(t => itemToRow(t, now));

  const CHUNK = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("tokens")
      .upsert(chunk, { onConflict: "chain,address" });
    if (error) {
      console.error(`  chunk ${i}–${i+chunk.length} failed:`, error.message);
    } else {
      total += chunk.length;
      console.log(`  upserted chunk ${i}–${i+chunk.length} (${total} done)`);
    }
  }

  // Verify
  const { count } = await supabase
    .from("tokens")
    .select("*", { count: "exact", head: true })
    .eq("chain", CHAIN)
    .eq("is_dead", false);

  console.log(`\nDone. Live tokens in Supabase: ${count}`);
}

main().catch(err => { console.error(err); process.exit(1); });
