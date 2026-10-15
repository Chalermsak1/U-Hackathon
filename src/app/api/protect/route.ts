import { z } from "zod";
import { recordProtection } from "@/lib/avalanche";
import { writeLog } from "@/lib/log";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ proposalId: z.string().uuid(), decision: z.enum(["approve", "decline"]) });

// The user's decision on a proposal. Only proposals the agent created on this server can
// be approved; the client never supplies the rule itself.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "proposalId and decision are required" }, { status: 400 });

  const proposal = store.proposals.get(parsed.data.proposalId);
  if (!proposal) return Response.json({ error: "Proposal not found. Ask U-Guard again." }, { status: 404 });
  if (proposal.status !== "pending") return Response.json({ error: `Already ${proposal.status}` }, { status: 409 });

  if (parsed.data.decision === "decline") {
    proposal.status = "declined";
    await writeLog({ type: "protect", proposalId: proposal.id, symbol: proposal.symbol, decision: "decline", mode: "none", txHash: null });
    return Response.json({ status: "declined" });
  }

  try {
    const receipt = await recordProtection(proposal);
    proposal.status = "approved";
    await writeLog({ type: "protect", proposalId: proposal.id, symbol: proposal.symbol, decision: "approve", mode: receipt.mode, txHash: receipt.txHash });
    return Response.json({ status: "approved", receipt });
  } catch (err) {
    await writeLog({ type: "error", route: "/api/protect", message: (err as Error).message });
    return Response.json({ error: "Couldn't record on Avalanche. Try again." }, { status: 502 });
  }
}
