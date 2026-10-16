import { getSession } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";
import { getHoldings } from "@/lib/portfolio";
import { usdToThb } from "@/lib/market";
import { withStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET() {
  const session = await getSession();
  if (!session) return jsonError(401, "Sign in to see your wallet.");
  const [holdings, fx] = await Promise.all([getHoldings(session.sub), usdToThb()]);
  const totalThb = holdings.reduce((s, h) => s + h.valueThb, 0);
  return Response.json({ holdings, totalThb, usdThb: fx });
}

export const GET = withStore(handleGET);
