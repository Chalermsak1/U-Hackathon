// Market-implied probabilities for real-world events, from prediction markets. U-Guard
// reports what traders are pricing; it never makes its own price forecast.
//
//   live    → Polymarket Gamma API (public, no key) when ODDS_SOURCE=live
//   offline → data/fixtures/odds.json (a snapshot as reported, with the reporting source)

import { config } from "../config";
import { readFixture } from "../fixtures";
import type { DataSource, OddsMarket, Sourced } from "../types";
import { SYMBOL_ALIASES } from "./news";

interface OddsFixture {
  asOf: string;
  mode?: DataSource;
  markets: (OddsMarket & { topics?: string[] })[];
}

const TOPIC_WORDS: Record<string, string[]> = {
  fed: ["fed", "fomc", "rate", "rates", "interest", "hike", "cut", "powell"],
  crypto: ["crypto", "bitcoin", "btc", "ethereum", "eth"],
  recession: ["recession", "gdp"],
  inflation: ["inflation", "cpi"],
};

function topicTerms(topic: string): string[] {
  const words = topic.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  const out = new Set(words);
  for (const w of words) {
    const sym = w.toUpperCase();
    for (const a of SYMBOL_ALIASES[sym] ?? []) out.add(a);
    for (const group of Object.values(TOPIC_WORDS)) if (group.includes(w)) group.forEach((g) => out.add(g));
  }
  return [...out];
}

function matches(text: string, terms: string[]): number {
  const words = new Set(text.toLowerCase().split(/[^a-z0-9]+/));
  return terms.filter((t) => words.has(t)).length;
}

interface GammaMarket {
  id: string;
  question: string;
  slug: string;
  outcomes: string; // JSON-encoded string array
  outcomePrices: string; // JSON-encoded string array
  volumeNum?: number;
  volume?: string;
  endDate?: string;
  events?: { slug?: string }[];
}

async function fetchPolymarket(terms: string[]): Promise<OddsMarket[]> {
  const res = await fetch(
    "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=200&order=volume24hr&ascending=false",
    { cache: "no-store", signal: AbortSignal.timeout(6000) },
  );
  if (!res.ok) throw new Error(`Polymarket ${res.status}`);
  const rows = (await res.json()) as GammaMarket[];
  return rows
    .map((m) => ({ m, hits: matches(m.question, terms) }))
    .filter((r) => r.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 5)
    .map(({ m }) => {
      const names = JSON.parse(m.outcomes || "[]") as string[];
      const prices = (JSON.parse(m.outcomePrices || "[]") as string[]).map(Number);
      const slug = m.events?.[0]?.slug;
      return {
        id: m.id,
        question: m.question,
        outcomes: names.map((name, i) => ({ name, probability: prices[i] ?? 0 })),
        provider: "Polymarket",
        url: slug ? `https://polymarket.com/event/${slug}` : `https://polymarket.com/market/${m.slug}`,
        endDate: m.endDate ? m.endDate.slice(0, 10) : null,
        volumeUsd: m.volumeNum ?? (m.volume ? Number(m.volume) : null),
      };
    });
}

export async function getEventOdds(topic: string): Promise<Sourced<OddsMarket[]>> {
  const terms = topicTerms(topic);
  let warning: string | undefined;
  if (config.intel.odds === "live") {
    try {
      return { data: await fetchPolymarket(terms), source: "live", asOf: new Date().toISOString() };
    } catch (err) {
      warning = `${(err as Error).message}; using the offline snapshot`;
    }
  }
  const fixture = await readFixture<OddsFixture>("odds.json");
  const data = (fixture?.markets ?? [])
    .map((m) => ({ m, hits: matches(`${m.question} ${(m.topics ?? []).join(" ")}`, terms) }))
    .filter((r) => r.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map(({ m }) => {
      const { topics: _topics, ...market } = m;
      return market;
    });
  return {
    data,
    source: fixture?.mode === "snapshot" ? "snapshot" : "sample",
    asOf: fixture?.asOf ?? new Date().toISOString(),
    warning,
  };
}
