import { getSession } from "@/lib/auth/session";
import { supplyForecast } from "@/lib/forecast";
import { jsonError, langOf } from "@/lib/http";
import { usdToThb } from "@/lib/market";
import { getHoldings } from "@/lib/portfolio";
import { assessUnlockRisk } from "@/lib/risk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Portfolio risk view: each holding with its unlock risk and 6-month dilution.
export async function GET(req: Request) {
  const locale = langOf(req);
  if (!(await getSession())) return jsonError(401, "Sign in to see your wallet.");
  const [holdings, fx] = await Promise.all([getHoldings(), usdToThb()]);
  const totalThb = holdings.reduce((s, h) => s + h.valueThb, 0);
  const rows = await Promise.all(
    holdings.map(async (h) => {
      const [risk, forecast] = await Promise.all([assessUnlockRisk(h.symbol, null, { locale }), supplyForecast(h.symbol, 6)]);
      return {
        ...h,
        weightPct: totalThb > 0 ? (h.valueThb / totalThb) * 100 : 0,
        card: risk.ok ? risk.card : null,
        dilutionPct: forecast?.dilutionPct ?? 0,
      };
    }),
  );
  const atRiskThb = rows.filter((r) => r.card && (r.card.level === "high" || r.card.level === "medium")).reduce((s, r) => s + r.valueThb, 0);
  const top = rows.reduce((a, b) => (b.weightPct > a.weightPct ? b : a), rows[0]);
  return Response.json({ rows, totalThb, atRiskThb, topHolding: top ? { symbol: top.symbol, weightPct: top.weightPct } : null, usdThb: fx });
}
