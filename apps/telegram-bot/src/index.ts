import { Telegraf } from "telegraf";

const TOKEN = process.env.TELEGRAM_TOKEN;
if (!TOKEN) throw new Error("TELEGRAM_TOKEN not set");

const API = "https://app.apescreener.store";
const CHAIN = 4663;
const BLOCKSCOUT = "https://robinhoodchain.blockscout.com";

const bot = new Telegraf(TOKEN);

// ── helpers ──────────────────────────────────────────────────────────────────

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmt(n: number, decimals = 2) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(decimals)}`;
}

function esc(s: string) {
  // Escape MarkdownV2 special chars
  return s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(25_000) });
    if (!r.ok) return null;
    return r.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ── /start & /help ────────────────────────────────────────────────────────────

const HELP = `🦍 *ApeScreener Bot*

Scan token di Robinhood Chain \\(ape\\.store\\)

*Commands:*
/scan \\<CA\\> — Scan token by contract address
/help — Tampilkan pesan ini

*Contoh:*
\`/scan 0x0ba813c7a084cb68aeb1b0f633821a112ab90629\``;

bot.start((ctx) => ctx.replyWithMarkdownV2(HELP));
bot.help((ctx) => ctx.replyWithMarkdownV2(HELP));

// ── /scan ─────────────────────────────────────────────────────────────────────

bot.command("scan", async (ctx) => {
  const parts = ctx.message.text.trim().split(/\s+/);
  const ca = parts[1]?.toLowerCase();

  if (!ca || !/^0x[0-9a-f]{40}$/i.test(ca)) {
    return ctx.reply("❌ Masukkan contract address yang valid.\n\nContoh: /scan 0xAbCd...");
  }

  const loading = await ctx.reply("🔍 Scanning…");

  // Fetch semua data paralel
  const [detail, bundlers, funding] = await Promise.all([
    fetchJson<any>(`${API}/api/token/${CHAIN}/${ca}`),
    fetchJson<any>(`${API}/api/token/${CHAIN}/${ca}/bundlers`),
    fetchJson<any>(`${API}/api/wallet/${ca}/funding`),  // funding for the CA itself (rare)
  ]);

  if (!detail || detail.error) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
    return ctx.reply("❌ Token tidak ditemukan. Pastikan CA benar dan token ada di ape.store Robinhood Chain.");
  }

  const token = detail;

  // ── Baris 1: nama + symbol ──
  const nameLine = `🪙 *${esc(token.name)}* \\($${esc(token.symbol)}\\)`;

  // ── Stats ──
  const mcap    = token.marketCap    ? fmt(token.marketCap)    : "—";
  const holders = token.holderCount  != null ? token.holderCount.toLocaleString() : "—";
  const created = token.createDate   ? timeAgo(token.createDate) : "—";
  const dex     = token.dexPaid      ? "✅ Paid" : "❌ Not paid";

  const statsLines = [
    `📊 Market Cap: *${esc(mcap)}*`,
    `👥 Holders: *${esc(holders)}*`,
    `🕐 Created: *${esc(created)}*`,
    `💳 DEX: ${dex}`,
  ].join("\n");

  // ── Creator ──
  const creatorAddr = token.creator ?? "";
  const launchCount: number = bundlers?.creatorLaunchCount ?? 0;
  const devTag = launchCount > 1
    ? ` ⚠️ *DEV ×${launchCount}*`
    : "";
  const creatorLine = creatorAddr
    ? `👤 Creator: [${esc(short(creatorAddr))}](${BLOCKSCOUT}/address/${creatorAddr})${devTag}`
    : "";

  // ── Bundle analysis ──
  let bundleLine = "📦 Bundle: _Tidak tersedia_";
  if (bundlers && !bundlers.error) {
    const visible    = (bundlers.bundles ?? []).filter((b: any) => !b.suppressed);
    const suppressed = bundlers.suppressedCount ?? 0;
    const earlyCount = bundlers.earlyBuyerCount ?? 0;

    if (visible.length === 0) {
      bundleLine = `📦 Bundle: ✅ Tidak ada bundle \\(${earlyCount} early buyers, ${suppressed} relay hidden\\)`;
    } else {
      const grouped = visible.map((b: any) =>
        `  • ${esc(short(b.funder))} → ${b.wallets?.length ?? 0} wallets \\(${b.holdPct?.toFixed(2) ?? "?"}%\\)`
      ).join("\n");
      bundleLine = `📦 Bundle: ⚠️ *${visible.length} grup terdeteksi*\n${grouped}`;
    }
  }

  // ── Funding trace of creator wallet ──
  let fundingLine = "";
  if (funding?.trace && !funding.funderSuppressed) {
    const f = funding.trace;
    const funder = f.from_address ?? "";
    const amt    = f.amount != null ? `${Number(f.amount).toFixed(4)} ETH` : "";
    const fanOut = funding.funderFanOut ?? 0;
    const fanTag = fanOut > 1 ? ` \\(funded *${fanOut}* dev wallets\\)` : "";
    fundingLine = `💸 Funding: [${esc(short(funder))}](${BLOCKSCOUT}/address/${funder}) ${esc(amt)}${fanTag}`;
  }

  // ── Links ──
  const links = [
    `[Screener](${API}/token/${CHAIN}/${ca})`,
    `[Blockscout](${BLOCKSCOUT}/token/${ca})`,
    `[ape\\.store](https://ape.store/robinhood/${ca})`,
  ].join(" \\| ");

  // ── Gabungkan ──
  const lines = [
    nameLine,
    "",
    statsLines,
    "",
    creatorLine,
    bundleLine,
    fundingLine,
    "",
    links,
  ].filter((l) => l !== undefined && l !== "");

  const text = lines.join("\n");

  await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
  await ctx.replyWithMarkdownV2(text, { disable_web_page_preview: true } as any);
});

// ── catch-all ──────────────────────────────────────────────────────────────────

bot.on("text", (ctx) => {
  ctx.reply("Gunakan /scan <CA> untuk scan token, atau /help untuk bantuan.");
});

// ── timeAgo helper ─────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── launch ─────────────────────────────────────────────────────────────────────

bot.launch({ dropPendingUpdates: true });
console.log("🤖 ApeScreener bot running…");

process.once("SIGINT",  () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
