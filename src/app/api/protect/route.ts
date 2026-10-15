import { getSession } from "@/lib/auth/session";
import { recordProtection } from "@/lib/avalanche";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { checkPost, handleError, jsonError, readJson, tooMany } from "@/lib/http";
import { logEvent } from "@/lib/log";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Approve/decline a proposal. Only proposals created by the server for this user can be
// approved; the client never supplies the rule itself.
export async function POST(req: Request) {
  const blocked = checkPost(req);
  if (blocked) return blocked;
  try {
    const session = await getSession();
    if (!session) return jsonError(401, "Sign in to approve protection rules.");
    const limit = rateLimit(`protect:${session.sub}`, LIMITS.protect.max, LIMITS.protect.windowMs);
    if (!limit.ok) return tooMany(limit);

    const body = await readJson<{ proposalId?: unknown; decision?: unknown }>(req);
    const record = typeof body.proposalId === "string" ? store.proposals.get(body.proposalId) : undefined;
    if (!record || record.ownerId !== session.sub) return jsonError(404, "Proposal not found. Ask again to get a fresh one.");
    if (body.decision !== "approve" && body.decision !== "decline") return jsonError(400, "decision must be approve or decline.");

    if (record.proposal.status !== "pending") {
      return Response.json({ proposal: record.proposal, receipt: record.receipt ?? null });
    }
    if (body.decision === "decline") {
      record.proposal.status = "declined";
      logEvent("protect.declined", { userId: session.sub, proposalId: record.proposal.id });
      return Response.json({ proposal: record.proposal, receipt: null });
    }
    try {
      record.receipt = await recordProtection(record.proposal);
    } catch (err) {
      logEvent("protect.chain_error", { proposalId: record.proposal.id, error: (err as Error).message.slice(0, 160) });
      return jsonError(502, "Could not record the rule on Avalanche right now. Please try again.");
    }
    record.proposal.status = "approved";
    logEvent("protect.approved", { userId: session.sub, proposalId: record.proposal.id, mode: record.receipt.mode, tx: record.receipt.txHash });
    return Response.json({ proposal: record.proposal, receipt: record.receipt });
  } catch (err) {
    return handleError(err);
  }
}
