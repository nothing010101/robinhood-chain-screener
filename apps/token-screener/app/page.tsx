"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Toolbar, SortKey, SortOrder } from "@/components/Toolbar";
import { TokenTable } from "@/components/TokenTable";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { ApeStoreTokenListItem } from "@/lib/apestore";

// Architecture: fetch ALL tokens from Supabase once on mount (and every 30s
// for freshness), store in state, then sort/filter entirely in JS memory.
//
// This gives instant sort switching (<5ms) instead of a Supabase round-trip
// on every tab click. The initial load is ~1.5s (4 parallel Supabase Range
// requests for ~3 000 tokens). Subsequent sort changes cost zero network.

const STALE_MS = 30_000; // re-fetch when data is older than this

export default function HomePage() {
  const { t } = useLanguage();
  const [items, setItems]               = useState<ApeStoreTokenListItem[]>([]);
  const [status, setStatus]             = useState<"loading" | "ready" | "error">("loading");
  const [search, setSearch]             = useState("");
  const [sortKey, setSortKey]           = useState<SortKey>("marketCap");
  const [sortOrder, setSortOrder]       = useState<SortOrder>("desc");
  const [launchCounts, setLaunchCounts] = useState<Record<string, number>>({});
  const [showSerialDevOnly, setShowSerialDevOnly] = useState(false);
  const [lastUpdated, setLastUpdated]   = useState<number | null>(null);
  const [nowTick, setNowTick]           = useState(0);

  // 1-second ticker drives the "updated Ns ago" readout.
  useEffect(() => {
    const tick = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Skip if data is fresh — the setInterval below will call load() every
      // STALE_MS; guard so back-to-back triggers don't fire duplicate fetches.
      if (lastUpdated && Date.now() - lastUpdated < STALE_MS - 1_000) return;

      try {
        // No sort param — data arrives in DB-default order (marketCap DESC,
        // which is the most common view). All other sorts are done in memory.
        const res = await fetch("/api/tokens");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const all: ApeStoreTokenListItem[] = data.items ?? [];
        if (!cancelled) {
          setItems(all);
          setStatus("ready");
          setLastUpdated(Date.now());
        }

        // Serial-dev: fetch creator launch counts in background after data lands.
        const creators = Array.from(new Set(all.map((t) => t.creator)));
        if (creators.length > 0 && !cancelled) {
          fetch("/api/wallet/launch-counts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ creators }),
          })
            .then((r) => r.json())
            .then((counts) => { if (!cancelled) setLaunchCounts(counts ?? {}); })
            .catch((err) => console.error("[launch-counts]", err));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus("error");
      }
    }

    load();
    const interval = setInterval(load, STALE_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatedSecondsAgo =
    lastUpdated != null ? Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000)) : null;
  void nowTick;

  // All filtering and sorting happens here in JS — zero network cost.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? items.filter((t) => t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q))
      : items;

    if (showSerialDevOnly) {
      list = list.filter((t) => (launchCounts[t.creator.toLowerCase()] ?? 0) > 1);
    }

    // Client-side sort — runs in <5ms for 3 000 tokens.
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "marketCap": cmp = (a.marketCap ?? 0) - (b.marketCap ?? 0); break;
        case "volume":    cmp = (a.volumeStat?.volumeUSD ?? 0) - (b.volumeStat?.volumeUSD ?? 0); break;
        case "name":      cmp = a.name.localeCompare(b.name); break;
        case "newest":    cmp = new Date(a.deployDate ?? a.createDate ?? 0).getTime()
                              - new Date(b.deployDate ?? b.createDate ?? 0).getTime(); break;
      }
      return sortOrder === "desc" ? -cmp : cmp;
    });

    return list;
  }, [items, search, sortKey, sortOrder, showSerialDevOnly, launchCounts]);

  return (
    <main className="min-h-screen bg-canvas bg-grid bg-[size:32px_32px]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-acid">
              <span className="h-1.5 w-1.5 rounded-full bg-acid" />
              {t.liveBadge} · Robinhood Chain · 4663
            </div>
            <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{t.brand}</h1>
            <p className="mt-1 text-sm text-muted">{t.tagline}</p>
          </div>
          {updatedSecondsAgo != null && (
            <div
              className="flex items-center gap-1.5 font-mono text-[11px] text-muted"
              title={t.updatedAgo.replace("{n}", String(updatedSecondsAgo))}
            >
              <span
                key={lastUpdated}
                className="h-1.5 w-1.5 rounded-full bg-acid2 [animation:ping_0.6s_ease-out_1]"
              />
              {t.updatedAgo.replace("{n}", String(updatedSecondsAgo))}
            </div>
          )}
        </header>

        <Toolbar
          search={search}
          onSearchChange={setSearch}
          sortKey={sortKey}
          onSortKeyChange={setSortKey}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          resultCount={filtered.length}
          showSerialDevOnly={showSerialDevOnly}
          onSerialDevOnlyChange={setShowSerialDevOnly}
        />

        <div className="mt-6">
          {status === "loading" && (
            <div className="flex items-center gap-3 py-16 justify-center font-mono text-sm text-muted">
              <span className="h-2 w-2 animate-pulse rounded-full bg-acid" />
              {t.loading}
            </div>
          )}
          {status === "error" && (
            <div className="rounded-lg border border-bear/30 bg-bear/5 px-4 py-6 text-center text-sm text-bear">
              {t.error}
            </div>
          )}
          {status === "ready" && filtered.length === 0 && (
            <div className="rounded-lg border border-line bg-panel px-4 py-16 text-center text-sm text-muted">
              {t.empty}
            </div>
          )}
          {status === "ready" && filtered.length > 0 && (
            <TokenTable items={filtered} launchCounts={launchCounts} />
          )}
        </div>

        <footer className="mt-10 border-t border-line pt-5 text-center font-mono text-[11px] text-muted">
          {t.footerNote}
        </footer>
      </div>
    </main>
  );
}
