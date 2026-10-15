import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { now } from "@/lib/config";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { anonId, checkPost, handleError, jsonError, tooMany } from "@/lib/http";
import { writeLog } from "@/lib/log";
import { draftTradePlan } from "@/lib/trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Input = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,20}$/),
  side: z.enum(["buy", "sell"]),
  amountThb: z.number().finite().min(100).max(10_000_000),
  orderType: z.enum(["market", "limit"]).default("market"),
  limitPriceUsd: z.number().finite().positive().nullable().optional(),
  stopLossPct: z.number().finite().min(2).max(50).optional(),
  riskBudgetPct: z.number().finite().min(0.5).max(10).optional(),
});

// Draft a trade plan around the user's own choice of token, side and amount, with U-Guard's checks.
export async function POST(req: Request) {
  const blocked = checkPost(req);
  if (blocked) return blocked;
  try {
    const session = await getSession();
    if (!session) return jsonError(401, "Sign in to draft a trade plan.");
    const key = `trade:${session.sub}${session.method === "demo" ? `:${anonId(req)}` : ""}`;
    const limit = rateLimit(key, LIMITS.agent.max, LIMITS.agent.windowMs);
    if (!limit.ok) return tooMany(limit);
    const parsed = Input.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "ต้องมี symbol, side (buy/sell) และ amountThb อย่างน้อย 100 บาท");
    const plan = await draftTradePlan(parsed.data, session.sub, now());
    if ("error" in plan) return jsonError(404, plan.error);
    await writeLog({ type: "trade_plan", planId: plan.id, symbol: plan.symbol, side: plan.side, amountThb: plan.amountThb, verdict: plan.verdict });
    return Response.json(plan);
  } catch (err) {
    await writeLog({ type: "error", route: "/api/trade/plan", message: (err as Error).message });
    return handleError(err);
  }
}
