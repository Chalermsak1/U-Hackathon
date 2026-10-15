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
  asOf: string; // when the price was observed (ISO)
  stale?: boolean; // live source failed; this is the last live quote
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

const liveCache = new Map<string, { at: number; quote: MarketQuote }>();

export async function getQuote(symbol: string): Promise<MarketQuote | null> {
  const sym = symbol.toUpperCase();
  if (config.market.source === "live" && COINGECKO_IDS[sym]) {
    const hit = liveCache.get(sym);
    if (hit && Date.now() - hit.at < 60_000) return hit.quote;
    try {
      const id = COINGECKO_IDS[sym];
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) },
      );
      if (res.ok) {
        const body = (await res.json()) as Record<string, { usd: number; usd_24h_vol: number; usd_24h_change?: number }>;
        if (body[id]) {
          const quote: MarketQuote = {
            symbol: sym,
            priceUsd: body[id].usd,
            volume24hUsd: body[id].usd_24h_vol,
            change24hPct: body[id].usd_24h_change ?? null,
            source: "live",
            asOf: new Date().toISOString(),
          };
          liveCache.set(sym, { at: Date.now(), quote });
          return quote;
        }
      }
    } catch {
      // fall through: last live quote, then the fixture
    }
    if (hit) return { ...hit.quote, stale: true };
  }
  const fx = await fixture();
  const row = fx.tokens[sym];
  return row
    ? { symbol: sym, priceUsd: row.priceUsd, volume24hUsd: row.volume24hUsd, change24hPct: row.change24hPct ?? null, source: "sample", asOf: fx.asOf }
    : null;
}
