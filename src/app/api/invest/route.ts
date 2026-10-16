import { getSession } from "@/lib/auth/session";
import { investDefaults, myInvestPlans } from "@/lib/invest";
import { withStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Questions, asset classes and model portfolios for the Invest page, plus the user's approved plans.
async function handleGET() {
  const session = await getSession();
  return Response.json({ ...(await investDefaults()), plans: session ? myInvestPlans(session.sub) : [] });
}

export const GET = withStore(handleGET);
