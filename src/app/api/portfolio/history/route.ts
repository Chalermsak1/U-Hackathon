import { getSession } from "@/lib/auth/session";
import { now } from "@/lib/config";
import { portfolioHistory } from "@/lib/history";
import { jsonError } from "@/lib/http";
import { withStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Portfolio value over the last 30 days (today's holdings at each day's price) plus the dated
// unlocks and Fed decisions coming in the next 30 days, for the Portfolio page chart.
async function handleGET() {
  const session = await getSession();
  if (!session) return jsonError(401, "Sign in to see your wallet.");
  return Response.json(await portfolioHistory(now(), session.sub));
}

export const GET = withStore(handleGET);
