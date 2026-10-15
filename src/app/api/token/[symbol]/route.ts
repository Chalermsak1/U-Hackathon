import { supplyForecast } from "@/lib/forecast";
import { getQuote } from "@/lib/market";
import { langOf } from "@/lib/http";
import { assessUnlockRisk } from "@/lib/risk";
import { findToken, getAllocations, getFundraising } from "@/lib/tokenomist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Everything the token page needs in one call.
export async function GET(req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  if (!/^[A-Za-z0-9.\-]{1,20}$/.test(symbol)) return Response.json({ error: "bad symbol" }, { status: 400 });
  const { token } = await findToken(symbol);
  if (!token) return Response.json({ tracked: false, symbol: symbol.toUpperCase() });

  const [risk, forecast, allocations, fundraising, quote] = await Promise.all([
    assessUnlockRisk(token.symbol, null, { locale: langOf(req) }),
    supplyForecast(token.symbol, 6),
    getAllocations(token.id),
    getFundraising(token.id),
    getQuote(token.symbol),
  ]);
  return Response.json({
    tracked: true,
    token: {
      symbol: token.symbol,
      name: token.name,
      marketCap: token.marketCap,
      circulating: token.circulatingSupply,
      maxSupply: token.maxSupply,
      floatPct: (token.circulatingSupply / token.maxSupply) * 100,
      priceUsd: quote?.priceUsd ?? token.marketCap / token.circulatingSupply,
      volume24hUsd: quote?.volume24hUsd ?? null,
    },
    card: risk.ok ? risk.card : null,
    forecast,
    allocations: allocations.data?.allocations ?? [],
    fundraising: fundraising.data?.fundingRounds ?? [],
    totalRaised: fundraising.data?.totalAmountRaised ?? null,
    source: allocations.source,
    // Each section says where its own numbers come from, so one page never mixes labels.
    sources: {
      unlocks: risk.ok ? { mode: risk.card.source.mode, asOf: risk.card.source.asOf } : null,
      allocations: { mode: allocations.source, asOf: allocations.asOf },
      fundraising: { mode: fundraising.source, asOf: fundraising.asOf },
    },
  });
}
