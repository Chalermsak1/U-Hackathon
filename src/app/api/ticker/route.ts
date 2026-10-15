import { now } from "@/lib/config";
import { assessUnlockRisk } from "@/lib/risk";
import { listTokens } from "@/lib/tokenomist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cache: { at: number; clock: number; body: unknown } | null = null;

// Unlocks for the Live Unlock Ticker, with U-Guard's risk level for each. `timing` says
// whether the unlock is upcoming, just happened (recent) or a continuous daily release.
export async function GET() {
  const t = now();
  if (cache && Date.now() - cache.at < 60_000 && cache.clock === Math.floor(t / 60_000)) return Response.json(cache.body);
  const tokens = (await listTokens()).data;
  const results = await Promise.all(tokens.map((tk) => assessUnlockRisk(tk.symbol, null, { now: t })));
  const items = results
    .flatMap((r) => (r.ok && r.card.unlockDate ? [r.card] : []))
    .sort((a, b) => (a.unlockDate! < b.unlockDate! ? -1 : 1))
    .map((c) => ({
      symbol: c.symbol,
      date: c.unlockDate,
      timing: c.timing,
      daysUntil: c.daysUntil,
      amount: c.amount,
      valueUsd: c.valueUsd,
      level: c.level,
      topRecipient: c.breakdown[0]?.recipient ?? null,
      source: c.source.mode,
    }));
  cache = { at: Date.now(), clock: Math.floor(t / 60_000), body: { items, now: new Date(t).toISOString() } };
  return Response.json(cache.body);
}
