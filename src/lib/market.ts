// Price and 24h volume. Tokenomist has no trading volume, which the risk score needs
// (unlock value ÷ daily volume), so this comes from CoinGecko or the market fixture.

import { config } from "./config";
import { readFixture } from "./fixtures";
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
  if (config.market.source === "live" && COINGECKO_IDS[sym]) {
    const hit = liveCache.get(sym);
    if (hit && Date.now() - hit.at < 60_000) return hit.quote;
    try {
      const id = COINGECKO_IDS[sym];
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd&include_24hr_vol=true`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const body = (await res.json()) as Record<string, { usd: number; usd_24h_vol: number }>;
        if (body[id]) {
          const quote = { symbol: sym, priceUsd: body[id].usd, volume24hUsd: body[id].usd_24h_vol, source: "live" as const };
          liveCache.set(sym, { at: Date.now(), quote });
          return quote;
        }
      }
    } catch {
      // fall through to the fixture
    }
  }
  const row = (await fixture()).tokens[sym];
  return row ? { symbol: sym, ...row, source: "sample" } : null;
}
