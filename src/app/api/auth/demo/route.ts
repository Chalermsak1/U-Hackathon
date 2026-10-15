import { publicUser, startSession } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { anonId, checkPost, handleError, jsonError, tooMany } from "@/lib/http";

export const runtime = "nodejs";

// One tap into the prepared demo account: no typing passwords in front of the judges.
// Disable with DEMO_LOGIN=false.
export async function POST(req: Request) {
  const blocked = checkPost(req);
  if (blocked) return blocked;
  try {
    if (!config.auth.demoLogin) return jsonError(403, "Demo sign-in is turned off.");
    const limit = rateLimit(`auth:demo:${anonId(req)}`, 30, LIMITS.auth.windowMs);
    if (!limit.ok) return tooMany(limit);
    const session = await startSession({ sub: "demo-user", name: "Demo User", email: "demo@u-guard.app", method: "demo" });
    return Response.json({ user: publicUser(session) });
  } catch (err) {
    return handleError(err);
  }
}
