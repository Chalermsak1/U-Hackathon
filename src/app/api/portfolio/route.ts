import { getSession } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";
import { getHoldings } from "@/lib/portfolio";
import { usdToThb } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return jsonError(401, "Sign in to see your wallet.");
  const [holdings, fx] = await Promise.all([getHoldings(), usdToThb()]);
  const totalThb = holdings.reduce((s, h) => s + h.valueThb, 0);
  return Response.json({ holdings, totalThb, usdThb: fx });
}
