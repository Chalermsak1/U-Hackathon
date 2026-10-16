// Portfolio value over the last 30 days: today's holdings × each day's closing price, from
// Hyperliquid's public daily candles (no key, generous limits) with CoinGecko's free history as
// the fallback; cached 30 minutes. It shows how the current mix has moved, not past trades:
// there is no transaction history yet. Stablecoins count at $1. Scheduled events for the next
// 30 days (token unlocks, Fed decisions) come from the event calendar, so the chart can show
// what is coming next to what already happened.

import { getEventCalendar } from "./intel/calendar";
import { usdToThb } from "./market";
import { getHoldings } from "./portfolio";

const IDS: Record<string, string> = {
  ARB: "arbitrum",
  WLD: "worldcoin-wld",
  AVAX: "avalanche-2",
  BTC: "bitcoin",
  ETH: "ethereum",
};
const STABLES = new Set(["USDC", "USDT", "DAI"]);
const TTL_MS = 30 * 60 * 1000;
const DAY = 86_400_000;
type Series = { prices: [number, number][]; provider: "Hyperliquid" | "CoinGecko" };
const cache = new Map<string, { at: number; series: Series }>();

export interface HistoryPoint {
  date: string; // YYYY-MM-DD (UTC)
  valueThb: number;
}

export interface PortfolioHistory {
  points: HistoryPoint[];
  changePct: number | null; // first point → last point
  events: { date: string; title: string; symbol?: string; kind: string; importance: string }[];
  /** Tokens priced from daily history; the rest are held flat at today's price. */
  priced: string[];
  flat: string[];
  providers: string[];
  source: "live" | "partial" | "unavailable";
  asOf: string;
}

/** Daily closes from Hyperliquid's perp candles, dated by the candle's day. */
async function fromHyperliquid(symbol: string, now: number): Promise<[number, number][] | null> {
  const res = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "candleSnapshot", req: { coin: symbol, interval: "1d", startTime: now - 32 * DAY, endTime: now } }),
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  const candles = (await res.json()) as { t: number; c: string }[];
  return Array.isArray(candles) && candles.length ? candles.map((c) => [c.t, Number(c.c)] as [number, number]) : null;
}

async function fromCoinGecko(symbol: string): Promise<[number, number][] | null> {
  const id = IDS[symbol];
  if (!id) return null;
  const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=30&interval=daily`, {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { prices?: [number, number][] };
  return body.prices?.length ? body.prices : null;
}

async function dailyPrices(symbol: string, now: number): Promise<Series | null> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.series;
  let series: Series | null = null;
  try {
    const hl = await fromHyperliquid(symbol, now);
    if (hl) series = { prices: hl, provider: "Hyperliquid" };
  } catch {}
  if (!series) {
    try {
      const cg = await fromCoinGecko(symbol);
      if (cg) series = { prices: cg, provider: "CoinGecko" };
    } catch {}
  }
  if (series) cache.set(symbol, { at: Date.now(), series });
  return series ?? hit?.series ?? null;
}

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function portfolioHistory(now = Date.now()): Promise<PortfolioHistory> {
  const [holdings, fx, calendar] = await Promise.all([getHoldings(), usdToThb(), getEventCalendar(30, { now }).catch(() => [])]);

  // One point per UTC day: that day's closing price (today: the latest price).
  const days = Array.from({ length: 31 }, (_, i) => dayKey(now - (30 - i) * DAY));
  const priced: string[] = [];
  const flat: string[] = [];
  const providers = new Set<string>();
  const perDay = new Map<string, Map<string, number>>(); // symbol → day → price

  const risky = holdings.filter((h) => !STABLES.has(h.symbol));
  const histories = await Promise.all(risky.map((h) => dailyPrices(h.symbol, now)));
  for (const [i, h] of risky.entries()) {
    const series = histories[i];
    if (!series) {
      flat.push(h.symbol);
      continue;
    }
    const byDay = new Map<string, number>();
    for (const [ms, p] of series.prices) byDay.set(dayKey(ms), p);
    perDay.set(h.symbol, byDay);
    priced.push(h.symbol);
    providers.add(series.provider);
  }

  const points: HistoryPoint[] = days.map((date) => {
    let usd = 0;
    for (const h of holdings) {
      if (STABLES.has(h.symbol)) {
        usd += h.amount;
        continue;
      }
      const byDay = perDay.get(h.symbol);
      // Missing day (or no history for this token): carry the nearest earlier price, else today's.
      let price = byDay?.get(date);
      if (price === undefined && byDay) {
        const earlier = [...byDay.keys()].filter((d) => d <= date).sort().pop();
        price = earlier ? byDay.get(earlier) : undefined;
      }
      usd += h.amount * (price ?? h.priceUsd);
    }
    return { date, valueThb: Math.round(usd * fx) };
  });

  const first = points[0]?.valueThb ?? 0;
  const last = points[points.length - 1]?.valueThb ?? 0;
  const held = new Set(holdings.map((h) => h.symbol));
  const today = dayKey(now);
  const events = calendar
    .filter((e) => e.date >= today && (!e.symbol || held.has(e.symbol)))
    .map((e) => ({ date: e.date, title: e.title, symbol: e.symbol, kind: e.kind, importance: e.importance }));

  return {
    points,
    changePct: first > 0 ? ((last - first) / first) * 100 : null,
    events,
    priced,
    flat,
    providers: [...providers],
    source: priced.length === 0 ? "unavailable" : flat.length ? "partial" : "live",
    asOf: new Date(now).toISOString(),
  };
}
