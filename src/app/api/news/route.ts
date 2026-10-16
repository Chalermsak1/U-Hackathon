import { config } from "@/lib/config";
import { readFixture } from "@/lib/fixtures";
import { latestHeadlines } from "@/lib/intel/feeds";
import type { NewsItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MarketEvent {
  symbol: string;
  date: string;
  summary: string;
  sizeNote: string;
  source: string;
  url: string;
}

// News page: live headlines (RSS) next to U-Guard's curated unlock reports and the unlock watch list.
export async function GET() {
  const [live, curated, calendar] = await Promise.all([
    config.intel.news === "fixture" ? Promise.resolve([] as NewsItem[]) : latestHeadlines(),
    readFixture<{ asOf: string; mode?: string; items: NewsItem[] }>("news.json"),
    readFixture<{ events: MarketEvent[] }>("unlock-calendar.json"),
  ]);
  return Response.json({
    live,
    curated: [...(curated?.items ?? [])].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    unlocks: (calendar?.events ?? []).sort((a, b) => a.date.localeCompare(b.date)),
    sources: { live: live.length ? "Cointelegraph · CoinDesk · Decrypt (RSS)" : null, curatedAsOf: curated?.asOf ?? null },
  });
}
