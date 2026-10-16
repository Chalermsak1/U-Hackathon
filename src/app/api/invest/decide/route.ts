import { getSession } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { checkPost, handleError, jsonError, readJson, tooMany } from "@/lib/http";
import { logEvent } from "@/lib/log";
import { decideInvestPlan } from "@/lib/invest";
import { withStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Approve or decline an invest plan; approval is recorded on Avalanche Fuji (simulated without a key).
async function handlePOST(req: Request) {
  const blocked = checkPost(req);
  if (blocked) return blocked;
  try {
    const session = await getSession();
    if (!session) return jsonError(401, "Sign in to approve a plan.");
    const limit = rateLimit(`protect:${session.sub}`, LIMITS.protect.max, LIMITS.protect.windowMs);
    if (!limit.ok) return tooMany(limit);
    const body = await readJson<{ planId?: unknown; decision?: unknown }>(req);
    if (typeof body.planId !== "string") return jsonError(400, "planId is required.");
    if (body.decision !== "approve" && body.decision !== "decline") return jsonError(400, "decision must be approve or decline.");
    const res = await decideInvestPlan(body.planId, body.decision, session.sub);
    if (!res.ok) return jsonError(res.status, res.error);
    logEvent("invest.decided", { userId: session.sub, planId: res.plan.id, decision: body.decision, mode: res.plan.receipt?.mode ?? "none" });
    return Response.json({ status: res.plan.status, plan: res.plan });
  } catch (err) {
    return handleError(err);
  }
}

export const POST = withStore(handlePOST);
