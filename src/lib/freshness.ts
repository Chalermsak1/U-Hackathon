// Freshness contract (AGENTIC-WORKFLOW.md §6). Every piece of data the agent or the UI
// shows carries where it came from, when the source produced it, how long we may reuse
// it, and whether it is stale (past its TTL, or a live source failed and we fell back).
// No Node imports: the UI uses the same helpers to print "ณ 14:05".

import type { DataSource } from "./types";

export interface Freshness {
  provider: string; // "Tokenomist", "CoinGecko", "Web search", "U-topia wallet", ...
  mode: DataSource; // live | sample
  asOf: string; // when the source produced the data (ISO)
  fetchedAt: string; // when we got it (ISO)
  ttlSeconds: number; // how long it may be reused for an answer
  stale: boolean;
  note?: string; // why it is stale, e.g. "Tokenomist 503; showing the last good copy"
}

/** Seconds each kind of data may be reused before it must be fetched again. */
export const TTL = {
  price: 60,
  holdings: 60,
  tokenList: 3600,
  unlockSchedule: 86_400,
  allocations: 7 * 86_400,
  fundraising: 7 * 86_400,
  news: 900,
} as const;

export function makeFresh(
  provider: string,
  mode: DataSource,
  asOf: string,
  ttlSeconds: number,
  opts: { fetchedAt?: string; stale?: boolean; note?: string } = {},
): Freshness {
  return {
    provider,
    mode,
    asOf,
    fetchedAt: opts.fetchedAt ?? new Date().toISOString(),
    ttlSeconds,
    stale: opts.stale ?? false,
    ...(opts.note ? { note: opts.note } : {}),
  };
}

/**
 * Stale if a live source failed (flagged), or live data is being reused past its TTL.
 * Labelled sample data never changes, so age alone doesn't make it stale.
 */
export function isStale(f: Freshness, nowMs = Date.now()): boolean {
  return f.stale || (f.mode === "live" && new Date(f.fetchedAt).getTime() + f.ttlSeconds * 1000 < nowMs);
}

/** One entry per provider, keeping the oldest (worst) copy so the label never flatters. */
export function mergeFresh(list: Freshness[]): Freshness[] {
  const byProvider = new Map<string, Freshness>();
  for (const f of list) {
    const prev = byProvider.get(f.provider);
    if (!prev) {
      byProvider.set(f.provider, f);
      continue;
    }
    const older = new Date(f.asOf) < new Date(prev.asOf) ? f : prev;
    byProvider.set(f.provider, {
      ...older,
      mode: prev.mode === "sample" || f.mode === "sample" ? "sample" : "live",
      stale: prev.stale || f.stale,
      note: prev.note ?? f.note,
    });
  }
  return [...byProvider.values()];
}

/** "14:05" if the data is from today (Bangkok time), else "15 ต.ค. 07:00". */
export function asOfTh(iso: string, nowMs = Date.now()): string {
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
  if (day(d) === day(new Date(nowMs))) return time;
  return `${d.toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" })} ${time}`;
}

/** "Tokenomist ณ 15 ต.ค. 07:00 (ตัวอย่าง)" */
export function freshLabelTh(f: Freshness, nowMs = Date.now()): string {
  const tags = [f.mode === "sample" ? "ตัวอย่าง" : "", isStale(f, nowMs) ? "อาจไม่ล่าสุด" : ""].filter(Boolean);
  return `${f.provider} ณ ${asOfTh(f.asOf, nowMs)}${tags.length ? ` (${tags.join(", ")})` : ""}`;
}

/** Compact form for tool results, so the model can quote the time and see staleness. */
export function freshForModel(f: Freshness, nowMs = Date.now()) {
  return {
    provider: f.provider,
    mode: f.mode,
    as_of: f.asOf,
    as_of_th: asOfTh(f.asOf, nowMs),
    stale: isStale(f, nowMs),
    ...(f.note ? { note: f.note } : {}),
  };
}
