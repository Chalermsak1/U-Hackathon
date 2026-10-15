import { getSession } from "@/lib/auth/session";
import { recordProtection } from "@/lib/avalanche";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { checkPost, handleError, jsonError, readJson, tooMany } from "@/lib/http";
import { logEvent, writeLog } from "@/lib/log";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Approve/decline a proposal. Only proposals created by the server for this user can be
// approved; the client never supplies the rule itself. Every success returns
// {status, proposal, receipt}.
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
    const { proposal } = record;
    const reply = () => Response.json({ status: proposal.status, proposal, receipt: record.receipt ?? null });

    if (proposal.status !== "pending") {
      // Same decision again: idempotent. A different one: conflict.
      const same = (proposal.status === "approved") === (body.decision === "approve");
      if (same) return reply();
      return Response.json({ error: `Already ${proposal.status}.`, status: proposal.status, proposal, receipt: record.receipt ?? null }, { status: 409 });
    }
    if (body.decision === "decline") {
      proposal.status = "declined";
      logEvent("protect.declined", { userId: session.sub, proposalId: proposal.id });
      await writeLog({ type: "protect", proposalId: proposal.id, symbol: proposal.symbol, decision: "decline", mode: "none", txHash: null });
      return reply();
    }
    try {
      record.receipt = await recordProtection(proposal);
    } catch (err) {
      logEvent("protect.chain_error", { proposalId: proposal.id, error: (err as Error).message.slice(0, 160) });
      await writeLog({ type: "error", route: "/api/protect", message: (err as Error).message });
      return jsonError(502, "Could not record the rule on Avalanche right now. Please try again.");
    }
    proposal.status = "approved";
    logEvent("protect.approved", { userId: session.sub, proposalId: proposal.id, mode: record.receipt.mode, tx: record.receipt.txHash });
    await writeLog({ type: "protect", proposalId: proposal.id, symbol: proposal.symbol, decision: "approve", mode: record.receipt.mode, txHash: record.receipt.txHash });
    return reply();
  } catch (err) {
    return handleError(err);
  }
}
