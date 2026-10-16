import { getSession } from "@/lib/auth/session";
import { checkDrift, portfolioRisk } from "@/lib/drift";
import { jsonError, langOf } from "@/lib/http";
import { usdToThb } from "@/lib/market";
import { withStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Portfolio risk view: each holding with its unlock risk and 6-month dilution, plus drift
// from the user's own target mix.
async function handleGET(req: Request) {
  const locale = langOf(req);
  const session = await getSession();
  if (!session) return jsonError(401, "Sign in to see your wallet.");
  const [pre, fx] = await Promise.all([portfolioRisk({ locale }), usdToThb()]);
  const { rows, totalThb } = pre;
  const drift = await checkDrift(session.sub, { locale, pre });
  const atRiskThb = rows.filter((r) => r.card && (r.card.level === "high" || r.card.level === "medium")).reduce((s, r) => s + r.valueThb, 0);
  const top = rows.reduce((a, b) => (b.weightPct > a.weightPct ? b : a), rows[0]);
  return Response.json({ rows, totalThb, atRiskThb, topHolding: top ? { symbol: top.symbol, weightPct: top.weightPct } : null, usdThb: fx, drift });
}

export const GET = withStore(handleGET);
