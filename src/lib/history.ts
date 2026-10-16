// Portfolio value over the last 30 days: today's holdings × each day's price, from CoinGecko's
// free daily history (cached 30 minutes). It shows how the current mix has moved, not past
// trades: there is no transaction history yet. Stablecoins count at $1. Scheduled events for
// the next 30 days (token unlocks, Fed decisions) come from the event calendar, so the chart
// can show what is coming next to what already happened.

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
const cache = new Map<string, { at: number; prices: [number, number][] }>();

export interface HistoryPoint {
  date: string; // YYYY-MM-DD (UTC)
  valueThb: number;
}

export interface PortfolioHistory {
  points: HistoryPoint[];
  changePct: number | null; // first point → last point
  events: { date: string; title: string; symbol?: string; kind: string; importance: string }[];
  /** Tokens priced from CoinGecko history; the rest are held flat at today's price. */
  priced: string[];
  flat: string[];
  source: "live" | "partial" | "unavailable";
  asOf: string;
}

async function dailyPrices(id: string): Promise<[number, number][] | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.prices;
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=30&interval=daily`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return hit?.prices ?? null;
    const body = (await res.json()) as { prices?: [number, number][] };
    if (!body.prices?.length) return hit?.prices ?? null;
    cache.set(id, { at: Date.now(), prices: body.prices });
    return body.prices;
  } catch {
    return hit?.prices ?? null;
  }
}

const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function portfolioHistory(now = Date.now()): Promise<PortfolioHistory> {
  const [holdings, fx, calendar] = await Promise.all([getHoldings(), usdToThb(), getEventCalendar(30, { now }).catch(() => [])]);

  // One day per point: the last price CoinGecko gives for that UTC day.
  const days = Array.from({ length: 31 }, (_, i) => dayKey(now - (30 - i) * DAY));
  const priced: string[] = [];
  const flat: string[] = [];
  const perDay = new Map<string, Map<string, number>>(); // symbol → day → price

  for (const h of holdings) {
    if (STABLES.has(h.symbol)) continue;
    const id = IDS[h.symbol];
    const prices = id ? await dailyPrices(id) : null;
    if (!prices) {
      flat.push(h.symbol);
      continue;
    }
    const byDay = new Map<string, number>();
    for (const [ms, p] of prices) byDay.set(dayKey(ms), p);
    perDay.set(h.symbol, byDay);
    priced.push(h.symbol);
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
    source: priced.length === 0 ? "unavailable" : flat.length ? "partial" : "live",
    asOf: new Date(now).toISOString(),
  };
}
