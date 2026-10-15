import { checkDrift, portfolioRisk } from "@/lib/drift";
import { usdToThb } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Portfolio risk view: each holding with its unlock risk and 6-month dilution, plus drift
// from the user's target mix.
export async function GET() {
  const [pre, fx] = await Promise.all([portfolioRisk(), usdToThb()]);
  const { rows, totalThb } = pre;
  const drift = await checkDrift(pre);
  const atRiskThb = rows.filter((r) => r.card && (r.card.level === "high" || r.card.level === "medium")).reduce((s, r) => s + r.valueThb, 0);
  const top = rows.reduce((a, b) => (b.weightPct > a.weightPct ? b : a), rows[0]);
  return Response.json({ rows, totalThb, atRiskThb, topHolding: top ? { symbol: top.symbol, weightPct: top.weightPct } : null, usdThb: fx, drift });
}
