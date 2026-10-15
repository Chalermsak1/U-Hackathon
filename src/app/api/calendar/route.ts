import { readFixture } from "@/lib/fixtures";
import { assessUnlockRisk } from "@/lib/risk";
import { listTokens } from "@/lib/tokenomist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MarketEvent {
  symbol: string;
  date: string;
  summary: string;
  sizeNote: string;
  source: string;
  url: string;
  past?: boolean;
  dateApprox?: boolean;
}

// Unlock calendar: tokens U-Guard scores in full, plus market events from public reports.
export async function GET() {
  const tokens = (await listTokens()).data;
  const cards = (await Promise.all(tokens.map((t) => assessUnlockRisk(t.symbol))))
    .flatMap((r) => (r.ok && r.card.unlockDate ? [r.card] : []))
    .sort((a, b) => a.unlockDate!.localeCompare(b.unlockDate!));
  const market = (await readFixture<{ events: MarketEvent[] }>("unlock-calendar.json"))?.events ?? [];
  return Response.json({ analysed: cards, market });
}
