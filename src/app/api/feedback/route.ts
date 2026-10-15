import { getSession } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { sanitize } from "@/lib/guard/input";
import { anonId, checkPost, handleError, jsonError, readJson, tooMany } from "@/lib/http";
import { logEvent } from "@/lib/log";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 👍/👎 on an answer, keyed by requestId so it lines up with the agent.reply log line.
export async function POST(req: Request) {
  const blocked = checkPost(req);
  if (blocked) return blocked;
  try {
    const session = await getSession();
    const userId = session?.sub ?? `anon:${anonId(req)}`;
    const limit = rateLimit(`feedback:${userId}`, LIMITS.feedback.max, LIMITS.feedback.windowMs);
    if (!limit.ok) return tooMany(limit);
    const body = await readJson<{ requestId?: unknown; rating?: unknown; comment?: unknown }>(req);
    if (typeof body.requestId !== "string" || (body.rating !== "up" && body.rating !== "down")) {
      return jsonError(400, "requestId and rating (up|down) are required.");
    }
    const comment = typeof body.comment === "string" ? sanitize(body.comment, 500) : undefined;
    store.feedback.push({ requestId: body.requestId.slice(0, 64), userId, rating: body.rating, comment, at: new Date().toISOString() });
    logEvent("agent.feedback", { requestId: body.requestId.slice(0, 64), userId, rating: body.rating, hasComment: Boolean(comment) });
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
