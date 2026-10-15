import { getSession } from "@/lib/auth/session";
import { config } from "@/lib/config";
import { bearerMatches, jsonError } from "@/lib/http";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// What U-Bot pushed to a user (mock adapter). The app reads its own inbox; U-Bot itself may read
// any user's inbox with UBOT_API_KEY.
export async function GET(req: Request) {
  const asked = new URL(req.url).searchParams.get("userId");
  if (config.ubot.apiKey && bearerMatches(req, config.ubot.apiKey)) {
    return Response.json({ items: store.inbox.get(asked || "demo-user") ?? [] });
  }
  const session = await getSession();
  if (!session) return jsonError(401, "Sign in to read your U-Bot inbox.");
  if (asked && asked !== session.sub) return jsonError(403, "That inbox belongs to someone else.");
  return Response.json({ items: store.inbox.get(session.sub) ?? [] });
}
