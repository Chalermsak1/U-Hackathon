import { getSession } from "@/lib/auth/session";
import { now } from "@/lib/config";
import { jsonError } from "@/lib/http";
import { holdingsSchedule } from "@/lib/schedule";
import { withStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Unlock schedule (next 6 months) of the coins the user holds, from the Tokenomist API.
async function handleGET() {
  const session = await getSession();
  if (!session) return jsonError(401, "Sign in to see your schedule.");
  return Response.json(await holdingsSchedule(session.sub, now()));
}

export const GET = withStore(handleGET);
