import { runAgent } from "@/lib/agent";
import { getSession } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { anonId, checkPost, handleError, readJson, tooMany } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Signed-in users get the full agent; signed-out visitors (the U-Bot popup on public pages)
// get the same agent without wallet tools, at a lower rate limit.
export async function POST(req: Request) {
  const blocked = checkPost(req);
  if (blocked) return blocked;
  try {
    const session = await getSession();
    const limit = session
      ? rateLimit(`agent:u:${session.sub}`, LIMITS.agent.max, LIMITS.agent.windowMs)
      : rateLimit(`agent:ip:${anonId(req)}`, 8, 60_000);
    if (!limit.ok) return tooMany(limit);
    const body = await readJson<{ message?: unknown; history?: unknown; mode?: unknown }>(req);
    const result = await runAgent({
      message: body.message,
      history: body.history,
      mode: body.mode,
      userId: session?.sub ?? `anon:${anonId(req)}`,
      scope: session ? "user" : "public",
    });
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
