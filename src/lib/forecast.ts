// Supply forecast: how many new tokens the market must absorb, month by month, split into
// insiders (team + investors) and everyone else. Built only from scheduled unlocks, so it is
// known in advance; continuous (linear) releases are included only for the period the data
// covers and flagged as estimates.

import { now as clockNow } from "./config";
import { classifyRecipient } from "./risk";
import { findToken, getUnlockEvents } from "./tokenomist";
import type { DataSource } from "./types";

const DAY_MS = 86_400_000;

export interface ForecastMonth {
  month: string; // YYYY-MM
  label: string; // "Nov"
  insiders: number;
  other: number;
  estimate: boolean;
}

export interface SupplyForecast {
  symbol: string;
  name: string;
  circulating: number;
  months: ForecastMonth[];
  totalNew: number;
  pctOfCirculating: number; // new supply over the horizon ÷ circulating today
  dilutionPct: number; // how much a holder's share shrinks if they do nothing
  source: DataSource;
  asOf: string;
}

function monthKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 7);
}

export async function supplyForecast(symbol: string, months = 6, opts: { now?: number } = {}): Promise<SupplyForecast | null> {
  const { token } = await findToken(symbol);
  if (!token) return null;
  const t = opts.now ?? clockNow();
  const first = new Date(t);
  const buckets: ForecastMonth[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i, 1));
    buckets.push({
      month: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      insiders: 0,
      other: 0,
      estimate: false,
    });
  }
  const horizonEnd = Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + months, 1);
  const events = await getUnlockEvents(token.id, new Date(t).toISOString().slice(0, 10), new Date(horizonEnd).toISOString().slice(0, 10));
  const bucket = (ms: number) => buckets.find((b) => b.month === monthKey(ms));
  const add = (b: ForecastMonth | undefined, name: string, std: string, amount: number) => {
    if (!b || amount <= 0) return;
    const r = classifyRecipient(name, std);
    if (r === "team" || r === "investor") b.insiders += amount;
    else b.other += amount;
  };

  for (const e of events.data) {
    const at = Date.parse(e.unlockDate);
    if (e.cliffUnlocks && at > t && at < horizonEnd) {
      for (const a of e.cliffUnlocks.allocationBreakdown) add(bucket(at), a.allocationName, a.standardAllocationName, a.cliffAmount);
    }
    if (e.linearUnlocks) {
      const s = Math.max(at, t);
      const f = Math.min(Date.parse(e.endDate ?? e.unlockDate), horizonEnd);
      const span = Math.max(DAY_MS, Date.parse(e.endDate ?? e.unlockDate) - at);
      for (let d = s; d < f; d += DAY_MS) {
        const b = bucket(d);
        if (!b) continue;
        b.estimate = true;
        for (const a of e.linearUnlocks.allocationBreakdown ?? []) {
          add(b, a.allocationName, a.standardAllocationName, ((a.linearAmount ?? a.amount ?? 0) * DAY_MS) / span);
        }
      }
    }
  }

  const totalNew = buckets.reduce((s, b) => s + b.insiders + b.other, 0);
  const circ = token.circulatingSupply;
  return {
    symbol: token.symbol,
    name: token.name,
    circulating: circ,
    months: buckets,
    totalNew,
    pctOfCirculating: circ > 0 ? (totalNew / circ) * 100 : 0,
    dilutionPct: circ > 0 ? (1 - circ / (circ + totalNew)) * 100 : 0,
    source: events.source,
    asOf: events.asOf,
  };
}
