import { runAgent } from "@/lib/agent";
import { getSession } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { checkPost, handleError, jsonError, readJson, tooMany } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Portfolio watch (Flow B): the same agent, asked to scan the wallet.
export async function POST(req: Request) {
  const blocked = checkPost(req);
  if (blocked) return blocked;
  try {
    const session = await getSession();
    if (!session) return jsonError(401, "Sign in to scan your wallet.");
    const limit = rateLimit(`scan:${session.sub}`, LIMITS.scan.max, LIMITS.scan.windowMs);
    if (!limit.ok) return tooMany(limit);
    const body = await readJson<{ mode?: unknown }>(req);
    return Response.json(await runAgent({ message: "Scan my portfolio", mode: body.mode, userId: session.sub, scope: "user" }));
  } catch (err) {
    return handleError(err);
  }
}
