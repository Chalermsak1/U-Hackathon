import { z } from "zod";
import { runAgent } from "@/lib/agent";
import { config } from "@/lib/config";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { bearerMatches, handleError, jsonError, tooMany } from "@/lib/http";
import { logEvent } from "@/lib/log";
import { getUBot } from "@/lib/ubot";
import { withStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ userId: z.string().min(1).max(100), text: z.string().trim().min(1).max(500) });

// Inbound from U-Bot (server to server). Callers send UBOT_API_KEY as a Bearer token. Without
// a key the endpoint is open in development and disabled in production (same policy as /api/mcp).
async function handlePOST(req: Request) {
  const key = config.ubot.apiKey;
  if (!key && config.isProd) return jsonError(503, "U-Bot webhook is disabled: set UBOT_API_KEY.");
  if (key && !bearerMatches(req, key)) return jsonError(401, "unauthorized");
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "userId and text are required");
    const limit = rateLimit(`ubot:${parsed.data.userId}`, LIMITS.ubot.max, LIMITS.ubot.windowMs);
    if (!limit.ok) return tooMany(limit);
    const result = await runAgent({
      message: parsed.data.text,
      userId: parsed.data.userId,
      scope: "user",
      route: "/api/ubot/webhook",
    });
    await getUBot().send(parsed.data.userId, "reply", result);
    logEvent("ubot.webhook", { requestId: result.requestId, userId: parsed.data.userId });
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}

export const POST = withStore(handlePOST);
