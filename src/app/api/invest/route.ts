import { getSession } from "@/lib/auth/session";
import { investDefaults, myInvestPlans, pendingInvestPlans } from "@/lib/invest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Questions, asset classes and model portfolios for the Invest page, plus the user's approved plans
// and the ones still waiting for a decision (e.g. drafted by U-Bot over MCP).
export async function GET() {
  const session = await getSession();
  return Response.json({
    ...(await investDefaults()),
    plans: session ? myInvestPlans(session.sub) : [],
    pending: session ? pendingInvestPlans(session.sub) : [],
  });
}
