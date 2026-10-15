import { now } from "@/lib/config";
import { readFixture } from "@/lib/fixtures";
import { langOf } from "@/lib/http";
import { getEventCalendar } from "@/lib/intel/calendar";
import { assessUnlockRisk } from "@/lib/risk";
import { trackedTokens } from "@/lib/tokenomist";

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

// Unlock calendar: tokens U-Guard scores in full (cards carry `timing`: upcoming, recent or
// continuous), market events from public reports, and macro events.
export async function GET(req: Request) {
  const t = now();
  const locale = langOf(req);
  const tokens = (await trackedTokens()).data;
  const cards = (await Promise.all(tokens.map((tk) => assessUnlockRisk(tk.symbol, null, { now: t, locale }))))
    .flatMap((r) => (r.ok && r.card.unlockDate ? [r.card] : []))
    .sort((a, b) => a.unlockDate!.localeCompare(b.unlockDate!));
  const market = (await readFixture<{ events: MarketEvent[] }>("unlock-calendar.json"))?.events ?? [];
  // events: macro dates (FOMC) and scheduled cliffs from the agent's calendar tool.
  return Response.json({ analysed: cards, market, events: await getEventCalendar(45, { now: t }), now: new Date(t).toISOString() });
}
