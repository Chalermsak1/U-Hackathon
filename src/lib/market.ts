// Price and 24h volume. Tokenomist has no trading volume, which the risk score needs
// (unlock value ÷ daily volume), so this comes from CoinGecko or the market fixture.

import { config } from "./config";
import { readFixture } from "./fixtures";
import { TTL, makeFresh, type Freshness } from "./freshness";
import type { DataSource } from "./types";

// Ticker → CoinGecko id. Add a row for every token you demo with MARKET_SOURCE=live.
const COINGECKO_IDS: Record<string, string> = {
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
  source: DataSource;
  fresh: Freshness;
}

interface MarketFixture {
  asOf: string;
  usdThb: number;
  tokens: Record<string, { priceUsd: number; volume24hUsd: number }>;
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
  let failure: string | undefined;
  if (config.market.source === "live" && COINGECKO_IDS[sym]) {
    const hit = liveCache.get(sym);
    if (hit && Date.now() - hit.at < TTL.price * 1000) return hit.quote;
    try {
      const id = COINGECKO_IDS[sym];
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_vol=true&include_last_updated_at=true`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
      const body = (await res.json()) as Record<string, { usd: number; usd_24h_vol: number; last_updated_at?: number }>;
      const row = body[id];
      if (!row) throw new Error(`CoinGecko has no ${id}`);
      const asOf = row.last_updated_at ? new Date(row.last_updated_at * 1000).toISOString() : new Date().toISOString();
      const quote: MarketQuote = {
        symbol: sym,
        priceUsd: row.usd,
        volume24hUsd: row.usd_24h_vol,
        source: "live",
        fresh: makeFresh("ราคา CoinGecko", "live", asOf, TTL.price),
      };
      liveCache.set(sym, { at: Date.now(), quote });
      return quote;
    } catch (err) {
      failure = (err as Error).message;
      // Last good live quote beats the fixture, but say it is old.
      if (hit) return { ...hit.quote, fresh: { ...hit.quote.fresh, stale: true, note: `${failure}; showing the last good price` } };
    }
  }
  const fx = await fixture();
  const row = fx.tokens[sym];
  if (!row) return null;
  return {
    symbol: sym,
    ...row,
    source: "sample",
    fresh: makeFresh("ราคา", "sample", fx.asOf || new Date().toISOString(), TTL.price, {
      stale: failure !== undefined,
      note: failure ? `${failure}; using sample prices` : undefined,
    }),
  };
}
