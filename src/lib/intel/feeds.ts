// Live crypto headlines from public RSS feeds (Cointelegraph, CoinDesk, Decrypt): free, no key,
// fast. Each item is tagged with the tokens and topics it mentions so the agent's news search and
// the News page can filter it. Cached for five minutes; returns [] when every feed fails.

import type { NewsItem } from "../types";

const FEEDS = [
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { source: "Decrypt", url: "https://decrypt.co/feed" },
];

const SYMBOLS: Record<string, RegExp> = {
  BTC: /\b(bitcoin|btc)\b/i,
  ETH: /\b(ethereum|ether|eth)\b/i,
  ARB: /\b(arbitrum|arb)\b/i,
  WLD: /\b(worldcoin|wld|world network)\b/i,
  AVAX: /\b(avalanche|avax)\b/i,
  SOL: /\b(solana|sol)\b/i,
  HYPE: /\b(hyperliquid|hype)\b/i,
  USDC: /\b(usdc|circle)\b/i,
};

const TOPICS: Record<string, RegExp> = {
  unlock: /\b(unlock|unlocks|vesting|cliff|token supply|emission)\b/i,
  etf: /\b(etf|etfs|inflows?|outflows?)\b/i,
  fed: /\b(fed|fomc|powell|rate cut|rate hike|interest rate)\b/i,
  regulation: /\b(sec|regulat\w*|bill|law|ban|license|tax)\b/i,
  hack: /\b(hack|exploit|drain\w*|stolen|breach)\b/i,
  macro: /\b(inflation|cpi|recession|treasury|yields?|tariff\w*)\b/i,
};

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

const tag = (xml: string, name: string) => decode(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml)?.[1] ?? "");

function parse(xml: string, source: string): NewsItem[] {
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].slice(0, 30).flatMap((m, i) => {
    const raw = m[0];
    const title = tag(raw, "title");
    const url = tag(raw, "link") || /<link[^>]*href="([^"]+)"/i.exec(raw)?.[1] || "";
    if (!title || !/^https?:\/\//.test(url)) return [];
    const pub = Date.parse(tag(raw, "pubDate") || tag(raw, "dc:date"));
    const text = `${title} ${tag(raw, "description").slice(0, 400)}`;
    return [
      {
        id: `${source.toLowerCase()}-${i}-${url.slice(-24)}`,
        summary: title,
        source,
        url,
        date: Number.isFinite(pub) ? new Date(pub).toISOString().slice(0, 10) : null,
        dateLabel: Number.isFinite(pub) ? new Date(pub).toISOString() : undefined,
        symbols: Object.entries(SYMBOLS).flatMap(([s, re]) => (re.test(text) ? [s] : [])),
        topics: Object.entries(TOPICS).flatMap(([t, re]) => (re.test(text) ? [t] : [])),
        sentiment: null,
      } satisfies NewsItem,
    ];
  });
}

let cache: { at: number; items: NewsItem[] } | null = null;

export async function latestHeadlines(): Promise<NewsItem[]> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.items;
  const results = await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const res = await fetch(f.url, { cache: "no-store", signal: AbortSignal.timeout(5000), headers: { "user-agent": "Mozilla/5.0 (U-Guard news reader)" } });
        return res.ok ? parse(await res.text(), f.source) : [];
      } catch {
        return [];
      }
    }),
  );
  const seen = new Set<string>();
  const items = results
    .flat()
    .filter((i) => {
      const key = i.summary.toLowerCase().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (b.dateLabel ?? "").localeCompare(a.dateLabel ?? ""));
  if (items.length) cache = { at: Date.now(), items };
  return items.length ? items : (cache?.items ?? []);
}
