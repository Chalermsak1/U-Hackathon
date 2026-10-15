// Market pulse: BTC price, sentiment, ETF flows, and the options-implied range.
//
// The implied range is the market's own probability estimate: BTC's 30-day implied
// volatility (Deribit DVOL) scaled to N days gives a one-standard-deviation move, i.e. the
// band options traders price at roughly 68% odds. It is not a forecast by U-Guard.

import { config } from "../config";
import { readFixture } from "../fixtures";
import { getQuote } from "../market";
import type { DataSource, MarketPulse, Sourced } from "../types";

interface PulseFixture extends MarketPulse {
  asOf: string;
  mode?: DataSource;
}

export function impliedMove(priceUsd: number, annualVolPct: number, days: number) {
  const pct = annualVolPct * Math.sqrt(days / 365);
  return { pct, low: priceUsd * (1 - pct / 100), high: priceUsd * (1 + pct / 100) };
}

async function liveFearGreed(): Promise<MarketPulse["sentiment"]> {
  const res = await fetch("https://api.alternative.me/fng/?limit=1", { cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`alternative.me ${res.status}`);
  const body = (await res.json()) as { data?: { value: string; value_classification: string; timestamp: string }[] };
  const row = body.data?.[0];
  if (!row) throw new Error("alternative.me: empty");
  return {
    value: Number(row.value),
    label: row.value_classification,
    date: new Date(Number(row.timestamp) * 1000).toISOString().slice(0, 10),
    source: { name: "Alternative.me Fear & Greed", url: "https://alternative.me/crypto/fear-and-greed-index/" },
  };
}

async function liveDvol(): Promise<number> {
  const end = Date.now();
  const url = `https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&resolution=3600&start_timestamp=${end - 6 * 3_600_000}&end_timestamp=${end}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Deribit ${res.status}`);
  const body = (await res.json()) as { result?: { data?: number[][] } };
  const last = body.result?.data?.at(-1);
  if (!last) throw new Error("Deribit: empty");
  return last[4]; // [timestamp, open, high, low, close]
}

export async function getMarketPulse(): Promise<Sourced<MarketPulse>> {
  const fixture = await readFixture<PulseFixture>("pulse.json");
  const base: MarketPulse = {
    btc: fixture?.btc ?? null,
    sentiment: fixture?.sentiment ?? null,
    etfFlows: fixture?.etfFlows ?? [],
    impliedMove: fixture?.impliedMove ?? null,
  };
  const offline: Sourced<MarketPulse> = {
    data: base,
    source: fixture?.mode === "snapshot" ? "snapshot" : "sample",
    asOf: fixture?.asOf ?? new Date().toISOString(),
  };
  if (config.market.source !== "live") return offline;

  // Live mode: each reading is replaced independently; ETF flows stay on the snapshot
  // (no free live source).
  const today = new Date().toISOString().slice(0, 10);
  const pulse: MarketPulse = { ...base };
  let anyLive = false;
  const warnings: string[] = [];
  const quote = await getQuote("BTC");
  if (quote?.source === "live") {
    pulse.btc = {
      priceUsd: quote.priceUsd,
      change24hPct: quote.change24hPct,
      date: today,
      source: { name: "CoinGecko", url: "https://www.coingecko.com/en/coins/bitcoin" },
    };
    anyLive = true;
  }
  const [fng, dvol] = await Promise.allSettled([liveFearGreed(), liveDvol()]);
  if (fng.status === "fulfilled") {
    pulse.sentiment = fng.value;
    anyLive = true;
  } else warnings.push(String(fng.reason));
  if (dvol.status === "fulfilled" && pulse.btc) {
    const m = impliedMove(pulse.btc.priceUsd, dvol.value, 7);
    pulse.impliedMove = {
      asset: "BTC",
      days: 7,
      ...m,
      source: { name: "Deribit DVOL", url: "https://www.deribit.com/statistics/BTC/volatility-index" },
    };
    anyLive = true;
  } else if (dvol.status === "rejected") warnings.push(String(dvol.reason));
  return {
    data: pulse,
    source: anyLive ? "live" : offline.source,
    asOf: anyLive ? new Date().toISOString() : offline.asOf,
    warning: warnings.length ? warnings.join("; ") : undefined,
  };
}
