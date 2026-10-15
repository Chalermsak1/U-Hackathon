import { getSession } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { checkPost, handleError, jsonError, readJson, tooMany } from "@/lib/http";
import { logEvent, writeLog } from "@/lib/log";
import { decideTradePlan } from "@/lib/trade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Approve or decline a drafted trade plan. Approval places a paper order and records the decision
// on Avalanche Fuji (simulated without DEMO_PRIVATE_KEY). Only the plan's owner can decide.
export async function POST(req: Request) {
  const blocked = checkPost(req);
  if (blocked) return blocked;
  try {
    const session = await getSession();
    if (!session) return jsonError(401, "Sign in to approve a trade plan.");
    const limit = rateLimit(`protect:${session.sub}`, LIMITS.protect.max, LIMITS.protect.windowMs);
    if (!limit.ok) return tooMany(limit);
    const body = await readJson<{ planId?: unknown; decision?: unknown }>(req);
    if (typeof body.planId !== "string") return jsonError(400, "planId is required.");
    if (body.decision !== "approve" && body.decision !== "decline") return jsonError(400, "decision must be approve or decline.");
    const res = await decideTradePlan(body.planId, body.decision, session.sub);
    if (!res.ok) return Response.json({ error: res.error, plan: res.plan ?? null }, { status: res.status });
    logEvent("trade.decided", { userId: session.sub, planId: res.plan.id, decision: body.decision, mode: res.order?.receipt.mode ?? "none" });
    await writeLog({ type: "trade", planId: res.plan.id, symbol: res.plan.symbol, decision: body.decision, mode: res.order?.receipt.mode ?? "none", txHash: res.order?.receipt.txHash ?? null });
    return Response.json({ status: res.plan.status, plan: res.plan, order: res.order });
  } catch (err) {
    return handleError(err);
  }
}
