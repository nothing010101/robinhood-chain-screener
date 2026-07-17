"use client";

import { useState, useEffect } from "react";
import { shortenAddress } from "@/lib/format";

interface Holder {
  address: string;
  holdPct: number;
  launchCount: number;
  isDevWallet: boolean;
}

interface HolderListProps {
  chain: string;
  address: string;
}

export function HolderList({ chain, address }: HolderListProps) {
  const [holders, setHolders] = useState<Holder[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus("loading");
    fetch(`/api/token/${chain}/${address}/holders`)
      .then((r) => r.json())
      .then((data) => {
        setHolders(data.holders ?? []);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [open, chain, address]);

  const devCount = holders.filter((h) => h.isDevWallet).length;

  return (
    <div className="mt-4 rounded-lg border border-line bg-panel">
      {/* Header — always visible, click to expand */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
          Holders
        </span>
        <span className="flex items-center gap-2">
          {devCount > 0 && status === "ready" && (
            <span className="rounded bg-bear/20 px-1.5 py-0.5 font-mono text-[10px] text-bear">
              {devCount} dev wallet{devCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className="font-mono text-[10px] text-muted">{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div className="border-t border-line px-4 pb-3">
          {status === "loading" && (
            <p className="py-3 font-mono text-xs text-muted">Loading holders…</p>
          )}
          {status === "error" && (
            <p className="py-3 font-mono text-xs text-bear">Failed to load holders.</p>
          )}
          {status === "ready" && holders.length === 0 && (
            <p className="py-3 font-mono text-xs text-muted">No holders found.</p>
          )}
          {status === "ready" && holders.length > 0 && (
            <ul className="mt-2 space-y-1">
              {holders.map((h, i) => (
                <li key={h.address} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    {/* Rank */}
                    <span className="w-5 font-mono text-[10px] text-muted/50 tabular-nums">
                      {i + 1}
                    </span>
                    {/* Address */}
                    <a
                      href={`https://robinhoodchain.blockscout.com/address/${h.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-acid hover:underline"
                    >
                      {shortenAddress(h.address)}
                    </a>
                    {/* Dev badge */}
                    {h.isDevWallet && (
                      <span
                        title={`Launched ${h.launchCount} token${h.launchCount !== 1 ? "s" : ""} on Robinhood Chain`}
                        className="rounded bg-bear/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-bear"
                      >
                        dev ×{h.launchCount}
                      </span>
                    )}
                  </span>
                  {/* Hold % */}
                  <span className="font-mono text-xs tabular-nums text-ink">
                    {h.holdPct.toFixed(2)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
