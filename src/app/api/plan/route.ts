import { getSession } from "@/lib/auth/session";
import { now } from "@/lib/config";
import { jsonError, langOf } from "@/lib/http";
import { buildPlan } from "@/lib/plan";
import { withStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The user's 30-day plan: dated unlocks of their coins, Fed dates, DCA buys, open decisions and rules.
async function handleGET(req: Request) {
  const session = await getSession();
  if (!session) return jsonError(401, "Sign in to see your plan.");
  return Response.json(await buildPlan(session.sub, { now: now(), locale: langOf(req) }));
}

export const GET = withStore(handleGET);
