"use client";

import Image from "next/image";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { formatUsd, formatPriceRaw, formatRelativeTime, shortenAddress } from "@/lib/format";
import { resolveIpfsUri } from "@/lib/ipfs";
import type { ApeStoreTokenListItem } from "@/lib/apestore";

function TokenLogo({ item }: { item: ApeStoreTokenListItem }) {
  const [broken, setBroken] = useState(false);
  const src = resolveIpfsUri(item.logo);

  if (!src || broken) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-panel font-mono text-[11px] text-muted">
        {item.symbol.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={item.symbol}
      width={36}
      height={36}
      unoptimized
      onError={() => setBroken(true)}
      className="h-9 w-9 shrink-0 rounded-full border border-line object-cover"
    />
  );
}

export function TokenTable({ items }: { items: ApeStoreTokenListItem[] }) {
  const { t } = useLanguage();

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-panel text-left text-[11px] uppercase tracking-[0.15em] text-muted">
            <th className="px-4 py-3 font-medium">{t.columns.token}</th>
            <th className="px-4 py-3 font-medium text-right">{t.columns.price}</th>
            <th className="px-4 py-3 font-medium text-right">{t.columns.marketCap}</th>
            <th className="px-4 py-3 font-medium text-right">{t.columns.volume}</th>
            <th className="px-4 py-3 font-medium text-right">{t.columns.holders}</th>
            <th className="px-4 py-3 font-medium text-right">{t.columns.created}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={item.id}
              className={`group border-b border-line/60 transition-colors hover:bg-acid/5 ${
                i % 2 === 1 ? "bg-white/[0.015]" : ""
              }`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <TokenLogo item={item} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-ink">{item.name}</span>
                      {item.isKing && (
                        <span className="rounded-sm bg-acid/15 px-1.5 py-0.5 text-[10px] font-mono text-acid">
                          KING
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-muted">
                      {item.symbol} · {shortenAddress(item.address)}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono tabular text-ink">
                {formatPriceRaw(item.priceAfter)}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular text-ink">{formatUsd(item.marketCap)}</td>
              <td className="px-4 py-3 text-right font-mono tabular text-muted">
                {item.volumeStat != null ? formatUsd(item.volumeStat) : "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono tabular text-muted">{t.holdersUnavailable}</td>
              <td className="px-4 py-3 text-right font-mono tabular text-muted">
                {formatRelativeTime(item.createDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
