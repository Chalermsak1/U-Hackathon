import { assessUnlockRisk } from "@/lib/risk";
import { listTokens } from "@/lib/tokenomist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cache: { at: number; body: unknown } | null = null;

// Upcoming unlocks for the Live Unlock Ticker, with U-Guard's risk level for each.
export async function GET() {
  if (cache && Date.now() - cache.at < 60_000) return Response.json(cache.body);
  const tokens = (await listTokens()).data;
  const results = await Promise.all(tokens.map((t) => assessUnlockRisk(t.symbol)));
  const items = results
    .flatMap((r) => (r.ok && r.card.unlockDate ? [r.card] : []))
    .sort((a, b) => (a.unlockDate! < b.unlockDate! ? -1 : 1))
    .map((c) => ({
      symbol: c.symbol,
      date: c.unlockDate,
      amount: c.amount,
      valueUsd: c.valueUsd,
      level: c.level,
      topRecipient: c.breakdown[0]?.recipient ?? null,
      source: c.source.mode,
    }));
  cache = { at: Date.now(), body: { items } };
  return Response.json(cache.body);
}
