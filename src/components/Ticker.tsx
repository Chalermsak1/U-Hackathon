"use client";

import { useEffect, useState } from "react";
import { compact, LEVEL_TH, thaiDate, untilText } from "@/lib/format";

interface TickerItem {
  symbol: string;
  date: string;
  amount: number;
  level: "high" | "medium" | "low" | "none";
  topRecipient: string | null;
  source: "live" | "sample";
}

const RECIPIENT_TH: Record<string, string> = {
  team: "ทีม",
  investor: "นักลงทุน",
  community: "ชุมชน",
  reserve: "เงินสำรอง",
  ecosystem: "กองทุน ecosystem",
  other: "อื่นๆ",
};

/** Live Unlock Ticker: upcoming unlocks with U-Guard's risk level. Clicking one asks U-Guard about it. */
export function Ticker({ onPick }: { onPick?: (symbol: string) => void }) {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    fetch("/api/ticker")
      .then((r) => r.json())
      .then((b) => setItems(b.items ?? []))
      .catch(() => setItems([]));
  }, []);

  if (items.length === 0) return null;
  const loop = [...items, ...items, ...items, ...items];

  return (
    <div className="ticker" aria-label="Unlock ที่กำลังจะมาถึง">
      <div className="ticker-track">
        {loop.map((it, i) => (
          <button
            key={`${it.symbol}-${i}`}
            className={`ticker-item lv-${it.level}`}
            onClick={() => onPick?.(it.symbol)}
            aria-hidden={i >= items.length}
            tabIndex={i >= items.length ? -1 : 0}
            title={`ถาม U-Guard เรื่อง ${it.symbol}`}
          >
            <span className="dot" />
            <b>{it.symbol}</b>
            {untilText(it.date)} · {thaiDate(it.date)} · {compact(it.amount)}
            {it.topRecipient ? ` · ${RECIPIENT_TH[it.topRecipient] ?? it.topRecipient}` : ""}
            <span className="pill">{LEVEL_TH[it.level]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
