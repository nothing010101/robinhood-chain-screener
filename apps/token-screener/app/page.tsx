"use client";

import { useEffect, useMemo, useState } from "react";
import { Toolbar, SortKey, SortOrder } from "@/components/Toolbar";
import { TokenTable } from "@/components/TokenTable";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { ApeStoreTokenListItem } from "@/lib/apestore";

const PAGE_SIZE = 24;
const MAX_PAGES = 8; // pulls up to ~200 live tokens for a responsive client-side screener

export default function HomePage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<ApeStoreTokenListItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("marketCap");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [launchCounts, setLaunchCounts] = useState<Record<string, number>>({});
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(0);

  // The 20s poll below does fetch fresh data and does call setItems with it —
  // confirmed the numbers genuinely change each cycle. But per-cycle drift is
  // often just a few cents on a ~$1,700 market cap, so a refresh can be easy
  // to miss just by staring at the table. This ticker drives a small "updated
  // Ns ago" readout so a refresh is visible even when the numbers barely move.
  useEffect(() => {
    const tick = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const first = await fetch("/api/tokens?page=1").then((r) => r.json());
        if (first.error) throw new Error(first.error);

        let all: ApeStoreTokenListItem[] = first.items ?? [];
        const totalPages = Math.min(MAX_PAGES, Math.max(1, Math.ceil((first.pageCount ?? 0) / PAGE_SIZE)));

        const rest = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            fetch(`/api/tokens?page=${i + 2}`).then((r) => r.json()),
          ),
        );
        for (const page of rest) {
          if (page?.items) all = all.concat(page.items);
        }

        if (!cancelled) {
          setItems(all);
          setStatus("ready");
          setLastUpdated(Date.now());
        }

        // Phase 3: dev-wallet tracking — batched lookup of how many tokens
        // each creator in this page has launched (per our recorded history).
        const creators = Array.from(new Set(all.map((item) => item.creator)));
        if (creators.length > 0) {
          fetch(`/api/wallet/launch-counts?creators=${creators.join(",")}`)
            .then((r) => r.json())
            .then((counts) => {
              if (!cancelled) setLaunchCounts(counts ?? {});
            })
            .catch((err) => console.error("[launch-counts]", err));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus("error");
      }
    }

    load();
    const interval = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const updatedSecondsAgo = lastUpdated != null ? Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000)) : null;
  void nowTick; // referenced only to force a re-render each second so the line above recomputes

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? items.filter(
          (t) => t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q),
        )
      : items;

    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "marketCap":
          cmp = a.marketCap - b.marketCap;
          break;
        case "volume":
          cmp = (a.volumeStat?.volumeUSD ?? 0) - (b.volumeStat?.volumeUSD ?? 0);
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "newest":
          cmp = new Date(a.createDate).getTime() - new Date(b.createDate).getTime();
          break;
      }
      return sortOrder === "desc" ? -cmp : cmp;
    });

    return list;
  }, [items, search, sortKey, sortOrder]);

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
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted" title={t.updatedAgo.replace("{n}", String(updatedSecondsAgo))}>
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
