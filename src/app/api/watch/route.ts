import { getSession } from "@/lib/auth/session";
import { bearerMatches, jsonError } from "@/lib/http";
import { runWatch, watchStatus } from "@/lib/watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Watcher status for the alerts page.
export async function GET() {
  if (!(await getSession())) return jsonError(401, "Sign in to see the watcher.");
  return Response.json(watchStatus());
}

// One watcher pass for every user, for a cron on serverless hosts (Bearer CRON_SECRET).
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || !bearerMatches(req, secret)) return jsonError(401, "Bearer CRON_SECRET required.");
  return Response.json({ ...(await runWatch()), status: watchStatus() });
}
