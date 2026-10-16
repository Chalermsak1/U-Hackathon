import { getSession } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";
import { tradingSummary } from "@/lib/trade";
import { withStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The signed-in user's paper orders, net positions and plans still waiting for a decision.
async function handleGET() {
  const session = await getSession();
  if (!session) return jsonError(401, "Sign in to see your orders.");
  return Response.json(await tradingSummary(session.sub));
}

export const GET = withStore(handleGET);
