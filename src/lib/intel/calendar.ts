// One timeline of the scheduled events that can move a portfolio: macro dates (FOMC) and
// token unlocks. Everything here is scheduled in advance, so it is known, not predicted.

import { now as clockNow } from "../config";
import { readFixture } from "../fixtures";
import { compact } from "../format";
import { getUnlockEvents, listTokens } from "../tokenomist";
import type { CalendarEvent } from "../types";

interface CalendarFixture {
  events: CalendarEvent[];
}

export async function getEventCalendar(days = 45, opts: { now?: number } = {}): Promise<CalendarEvent[]> {
  const t = opts.now ?? clockNow();
  const start = new Date(t).toISOString().slice(0, 10);
  const end = new Date(t + days * 86_400_000).toISOString().slice(0, 10);

  const [fixture, tokens] = await Promise.all([readFixture<CalendarFixture>("calendar.json"), listTokens()]);
  const macro = (fixture?.events ?? []).filter((e) => e.date >= start && e.date <= end);

  const unlocks = await Promise.all(
    tokens.data.map(async (token) => {
      const events = await getUnlockEvents(token.id, start, end);
      return events.data
        .filter((e) => (e.cliffUnlocks?.cliffAmount ?? 0) > 0)
        .map((e): CalendarEvent => {
          const amount = e.cliffUnlocks!.cliffAmount;
          const pctCirc = token.circulatingSupply > 0 ? (amount / token.circulatingSupply) * 100 : 0;
          return {
            date: e.unlockDate.slice(0, 10),
            title: `${token.symbol} unlock: ${compact(amount, 2)} ${token.symbol} (${pctCirc.toFixed(2)}% of circulating)`,
            kind: "unlock",
            importance: pctCirc >= 1 ? "high" : pctCirc >= 0.3 ? "medium" : "low",
            symbol: token.symbol,
            source: { name: "Tokenomist", url: token.websiteUrl || "https://tokenomist.ai" },
          };
        });
    }),
  );

  return [...macro, ...unlocks.flat()].sort((a, b) => a.date.localeCompare(b.date));
}
