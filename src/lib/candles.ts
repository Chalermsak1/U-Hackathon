// Price candles for the token page chart: Hyperliquid's public candle API (no key), with
// CoinGecko's free market chart as a fallback for tokens Hyperliquid doesn't list.

import { findToken } from "./tokenomist";

export type Range = "7d" | "30d" | "90d";
export interface Candle {
  t: number; // open time, ms
  o: number;
  h: number;
  l: number;
  c: number;
}

const RANGES: Record<Range, { days: number; interval: string }> = {
  "7d": { days: 7, interval: "1h" },
  "30d": { days: 30, interval: "4h" },
  "90d": { days: 90, interval: "1d" },
};

const cache = new Map<string, { at: number; value: { candles: Candle[]; source: string } }>();

export async function getCandles(symbol: string, range: Range, now = Date.now()): Promise<{ candles: Candle[]; source: string }> {
  const sym = symbol.toUpperCase();
  const key = `${sym}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const { days, interval } = RANGES[range];

  let value: { candles: Candle[]; source: string } = { candles: [], source: "none" };
  try {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "candleSnapshot", req: { coin: sym, interval, startTime: now - days * 86_400_000, endTime: now } }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    const raw = res.ok ? ((await res.json()) as { t: number; o: string; h: string; l: string; c: string }[]) : [];
    if (Array.isArray(raw) && raw.length > 1) {
      value = { candles: raw.map((k) => ({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c })), source: "Hyperliquid" };
    }
  } catch {
    // try CoinGecko below
  }
  if (value.candles.length < 2) {
    try {
      const { token } = await findToken(sym);
      if (token) {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/${token.id}/market_chart?vs_currency=usd&days=${days}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        });
        const body = res.ok ? ((await res.json()) as { prices?: [number, number][] }) : {};
        const pts = body.prices ?? [];
        if (pts.length > 1) value = { candles: pts.map(([t, p]) => ({ t, o: p, h: p, l: p, c: p })), source: "CoinGecko" };
      }
    } catch {
      // no chart
    }
  }
  if (value.candles.length > 1) cache.set(key, { at: Date.now(), value });
  return value;
}
