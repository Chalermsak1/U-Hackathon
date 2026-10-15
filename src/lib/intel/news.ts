// News retrieval for the agent (the "R" in RAG). Agentic RAG: the agent decides when to
// call get_market_news; this module retrieves, ranks and returns citable items.
//
//   live    → GDELT DOC 2.0 API (global news, no key) when NEWS_SOURCE=live
//   offline → data/fixtures/news.json, a snapshot of real reporting with links
//
// Ranking is hybrid: lexical match on the question (with ticker/topic aliases) + ticker
// tag match, weighted by recency. Items below a relevance floor are dropped rather than
// forced into the answer (the corrective step: "no relevant news" beats a stretch).

import { config, now as clockNow } from "../config";
import { readFixture } from "../fixtures";
import type { DataSource, NewsItem, Sourced } from "../types";

const DAY_MS = 86_400_000;

export const SYMBOL_ALIASES: Record<string, string[]> = {
  BTC: ["bitcoin", "btc"],
  ETH: ["ethereum", "ether", "eth"],
  ARB: ["arbitrum", "arb"],
  WLD: ["worldcoin", "wld"],
  AVAX: ["avalanche", "avax"],
  USDC: ["usdc", "stablecoin"],
};

const TOPIC_ALIASES: Record<string, string[]> = {
  fed: ["fed", "fomc", "federal", "reserve", "rate", "rates", "hike", "cut", "powell"],
  etf: ["etf", "etfs", "flows", "inflows", "outflows"],
  unlock: ["unlock", "unlocks", "vesting", "cliff", "emission", "supply"],
  regulation: ["regulation", "regulator", "sec", "rules", "thailand", "license"],
  macro: ["macro", "inflation", "cpi", "economy", "yields", "dollar"],
};

const STOP = new Set(
  "the a an and or of to in on for is are was be it this that what whats why how with about news latest today week me my any there happening moving move going on into from by at as do does can could should would will".split(
    " ",
  ),
);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^a-z0-9฀-๿]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

interface NewsFixture {
  asOf: string;
  mode?: DataSource;
  items: NewsItem[];
}

export interface NewsQuery {
  query?: string;
  symbols?: string[];
  days?: number;
  limit?: number;
  now?: number;
}

function expandTerms(query: string, symbols: string[]): Set<string> {
  const terms = new Set(tokenize(query));
  for (const s of symbols) for (const a of SYMBOL_ALIASES[s] ?? [s.toLowerCase()]) terms.add(a);
  for (const words of Object.values(TOPIC_ALIASES)) {
    if (words.some((w) => terms.has(w))) words.forEach((w) => terms.add(w));
  }
  return terms;
}

export function rankNews(items: NewsItem[], query: string, symbols: string[], days: number, nowMs: number): NewsItem[] {
  const terms = expandTerms(query, symbols);
  const general = terms.size === 0;
  const scored = items.map((item) => {
    const words = new Set(tokenize(`${item.summary} ${item.topics.join(" ")}`));
    let lexical = 0;
    for (const t of terms) if (words.has(t)) lexical += 1;
    const tagged = symbols.some((s) => item.symbols.includes(s)) ? 2 : 0;
    const ageDays = item.date ? Math.max(0, (nowMs - Date.parse(item.date)) / DAY_MS) : 45;
    const recency = Math.exp(-ageDays / Math.max(7, days));
    const relevance = general ? recency : (lexical + tagged) * (0.5 + 0.5 * recency);
    return { ...item, relevance: Math.round(relevance * 100) / 100 };
  });
  const floor = general ? 0 : 1.5;
  const seen = new Set<string>();
  return scored
    .filter((i) => i.relevance >= floor)
    .filter((i) => (i.date ? (nowMs - Date.parse(i.date)) / DAY_MS <= 120 : true))
    .sort((a, b) => b.relevance - a.relevance)
    .filter((i) => {
      const key = i.summary.toLowerCase().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function gdeltDate(seen: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(seen);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

async function fetchGdelt(query: string, symbols: string[], days: number): Promise<NewsItem[]> {
  const words = [
    ...symbols.map((s) => SYMBOL_ALIASES[s]?.[0] ?? s.toLowerCase()),
    ...tokenize(query).filter((w) => w.length > 2 && /^[a-z0-9]+$/.test(w)),
  ];
  const terms = [...new Set(words)].slice(0, 6);
  if (terms.length === 0) terms.push("cryptocurrency");
  const q = `(${terms.join(" OR ")}) sourcelang:english`;
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=ArtList&format=json&maxrecords=50&sort=DateDesc&timespan=${Math.min(days, 90)}d`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`GDELT ${res.status}`);
  const body = (await res.json()) as { articles?: { url: string; title: string; seendate: string; domain: string }[] };
  return (body.articles ?? []).map((a, i) => {
    const title = a.title.toLowerCase();
    return {
      id: `gdelt-${i}`,
      summary: a.title,
      source: a.domain,
      url: a.url,
      date: gdeltDate(a.seendate),
      symbols: symbols.filter((s) => (SYMBOL_ALIASES[s] ?? [s.toLowerCase()]).some((al) => title.includes(al))),
      topics: [],
      sentiment: null,
    };
  });
}

export async function searchNews(q: NewsQuery): Promise<Sourced<NewsItem[]>> {
  const limit = Math.min(10, Math.max(1, q.limit ?? 4));
  const days = Math.min(90, Math.max(1, q.days ?? 14));
  const symbols = (q.symbols ?? []).map((s) => s.toUpperCase());
  const nowMs = q.now ?? clockNow();

  let warning: string | undefined;
  if (config.intel.news === "live") {
    try {
      const pool = await fetchGdelt(q.query ?? "", symbols, days);
      return {
        data: rankNews(pool, q.query ?? "", symbols, days, nowMs).slice(0, limit),
        source: "live",
        asOf: new Date(nowMs).toISOString(),
      };
    } catch (err) {
      warning = `${(err as Error).message}; using the offline snapshot`;
    }
  }
  const fixture = await readFixture<NewsFixture>("news.json");
  return {
    data: rankNews(fixture?.items ?? [], q.query ?? "", symbols, days, nowMs).slice(0, limit),
    source: fixture?.mode === "snapshot" ? "snapshot" : "sample",
    asOf: fixture?.asOf ?? new Date(nowMs).toISOString(),
    warning,
  };
}
