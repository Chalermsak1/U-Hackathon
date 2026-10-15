import { getHoldings } from "@/lib/portfolio";
import { usdToThb } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [holdings, fx] = await Promise.all([getHoldings(), usdToThb()]);
  const totalThb = holdings.reduce((s, h) => s + h.valueThb, 0);
  return Response.json({ holdings, totalThb, usdThb: fx });
}
