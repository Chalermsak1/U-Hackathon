// Supply forecast: the one market variable that is scheduled in advance. Groups the next
// N months of unlock events by recipient and works out dilution for a holder.

import { classifyRecipient } from "./recipient";
import { findToken, getUnlockEvents } from "./tokenomist";
import type { DataSource, RecipientClass } from "./types";

export interface ForecastMonth {
  month: string; // YYYY-MM
  total: number;
  byRecipient: Partial<Record<RecipientClass, number>>;
}

export interface Forecast {
  symbol: string;
  circulating: number;
  months: ForecastMonth[];
  totalNew: number;
  dilutionPct: number; // how much a holder's share of circulating supply shrinks
  pctOfMcapPerMonth: number | null;
  source: DataSource;
  asOf: string;
}

export async function supplyForecast(symbol: string, monthsAhead = 6): Promise<Forecast | null> {
  const { token } = await findToken(symbol);
  if (!token) return null;
  const now = new Date();
  const start = now.toISOString().slice(0, 10);
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthsAhead, 0));
  const events = await getUnlockEvents(token.id, start, endDate.toISOString().slice(0, 10));

  const months: ForecastMonth[] = [];
  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    months.push({ month: d.toISOString().slice(0, 7), total: 0, byRecipient: {} });
  }
  for (const e of events.data) {
    const m = months.find((x) => x.month === e.unlockDate.slice(0, 7));
    if (!m || !e.cliffUnlocks) continue;
    for (const a of e.cliffUnlocks.allocationBreakdown) {
      const r = classifyRecipient(a.allocationName, a.standardAllocationName);
      m.byRecipient[r] = (m.byRecipient[r] ?? 0) + a.cliffAmount;
      m.total += a.cliffAmount;
    }
  }
  const totalNew = months.reduce((s, m) => s + m.total, 0);
  const circulating = token.circulatingSupply;
  const price = circulating > 0 ? token.marketCap / circulating : 0;
  const avgMonthlyValue = (totalNew / monthsAhead) * price;
  return {
    symbol: token.symbol,
    circulating,
    months,
    totalNew,
    dilutionPct: circulating > 0 ? (1 - circulating / (circulating + totalNew)) * 100 : 0,
    pctOfMcapPerMonth: token.marketCap > 0 ? (avgMonthlyValue / token.marketCap) * 100 : null,
    source: events.source,
    asOf: events.asOf,
  };
}
