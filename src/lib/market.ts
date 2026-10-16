// Price and 24h volume. Tokenomist has no trading volume, which the risk score needs
// (unlock value ÷ daily volume), so this comes from CoinGecko or the market fixture.

import { config } from "./config";
import { readFixture } from "./fixtures";
import type { DataSource } from "./types";

// Ticker → CoinGecko id. Add a row for every token you demo with MARKET_SOURCE=live.
export const COINGECKO_IDS: Record<string, string> = {
  ARB: "arbitrum",
  WLD: "worldcoin-wld",
  AVAX: "avalanche-2",
  USDC: "usd-coin",
  USDT: "tether",
  BTC: "bitcoin",
  ETH: "ethereum",
};

export interface MarketQuote {
  symbol: string;
  priceUsd: number;
  volume24hUsd: number;
  change24hPct: number | null;
  source: DataSource;
}

interface MarketFixture {
  asOf: string;
  usdThb: number;
  tokens: Record<string, { priceUsd: number; volume24hUsd: number; change24hPct?: number | null }>;
}

let fixtureCache: MarketFixture | null = null;
async function fixture(): Promise<MarketFixture> {
  fixtureCache ??= (await readFixture<MarketFixture>("market.json")) ?? { asOf: "", usdThb: 32.5, tokens: {} };
  return fixtureCache;
}

export async function usdToThb(): Promise<number> {
  return (await fixture()).usdThb;
}

// Live quotes: one CoinGecko call per minute for every known symbol (the free API rate-limits
// per call, so symbols are batched), shared by concurrent callers.
let liveBatch: { at: number; quotes: Map<string, MarketQuote> } | null = null;
let liveInFlight: Promise<Map<string, MarketQuote> | null> | null = null;

async function liveQuotes(): Promise<Map<string, MarketQuote> | null> {
  if (liveBatch && Date.now() - liveBatch.at < 60_000) return liveBatch.quotes;
  liveInFlight ??= (async () => {
    try {
      const ids = [...new Set(Object.values(COINGECKO_IDS))].join(",");
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) },
      );
      if (!res.ok) return liveBatch?.quotes ?? null;
      const body = (await res.json()) as Record<string, { usd: number; usd_24h_vol: number; usd_24h_change?: number }>;
      const quotes = new Map<string, MarketQuote>();
      for (const [sym, id] of Object.entries(COINGECKO_IDS)) {
        const q = body[id];
        if (q) quotes.set(sym, { symbol: sym, priceUsd: q.usd, volume24hUsd: q.usd_24h_vol, change24hPct: q.usd_24h_change ?? null, source: "live" });
      }
      liveBatch = { at: Date.now(), quotes };
      return quotes;
    } catch {
      return liveBatch?.quotes ?? null; // a stale live quote beats sample data
    } finally {
      liveInFlight = null;
    }
  })();
  return liveInFlight;
}

export async function getQuote(symbol: string): Promise<MarketQuote | null> {
  const sym = symbol.toUpperCase();
  if (config.market.source === "live" && COINGECKO_IDS[sym]) {
    const quote = (await liveQuotes())?.get(sym);
    if (quote) return quote;
  }
  const row = (await fixture()).tokens[sym];
  return row
    ? { symbol: sym, priceUsd: row.priceUsd, volume24hUsd: row.volume24hUsd, change24hPct: row.change24hPct ?? null, source: "sample" }
    : null;
}

export interface MarketRow {
  id: string;
  priceUsd: number | null;
  change24hPct: number | null;
  change7dPct: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  volume24hUsd: number | null;
  image: string | null;
}

let marketsCache: { at: number; key: string; rows: Map<string, MarketRow> } | null = null;

/**
 * Market data for many tokens in one call (CoinGecko /coins/markets). Tokenomist's token ids
 * are CoinGecko ids ("arbitrum", "worldcoin-wld"), so the screener can join them directly.
 * Returns null when live market data is off or the call fails.
 */
export async function getMarkets(ids: string[]): Promise<Map<string, MarketRow> | null> {
  if (config.market.source !== "live" || ids.length === 0) return null;
  const key = [...ids].sort().join(",");
  if (marketsCache && marketsCache.key === key && Date.now() - marketsCache.at < 60_000) return marketsCache.rows;
  try {
    const qs = new URLSearchParams({ vs_currency: "usd", ids: ids.join(","), per_page: "100", price_change_percentage: "24h,7d" });
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?${qs}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) return marketsCache?.rows ?? null;
    const body = (await res.json()) as {
      id: string;
      current_price: number | null;
      market_cap: number | null;
      fully_diluted_valuation: number | null;
      total_volume: number | null;
      image: string | null;
      price_change_percentage_24h_in_currency?: number | null;
      price_change_percentage_7d_in_currency?: number | null;
    }[];
    const rows = new Map<string, MarketRow>(
      body.map((c) => [
        c.id,
        {
          id: c.id,
          priceUsd: c.current_price,
          change24hPct: c.price_change_percentage_24h_in_currency ?? null,
          change7dPct: c.price_change_percentage_7d_in_currency ?? null,
          marketCapUsd: c.market_cap,
          fdvUsd: c.fully_diluted_valuation,
          volume24hUsd: c.total_volume,
          image: c.image,
        },
      ]),
    );
    marketsCache = { at: Date.now(), key, rows };
    return rows;
  } catch {
    return marketsCache?.rows ?? null;
  }
}
