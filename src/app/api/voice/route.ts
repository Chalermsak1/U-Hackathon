import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { anonId, checkPost, handleError, readJson, tooMany } from "@/lib/http";
import { logEvent } from "@/lib/log";
import { speakable, synthesize, voiceConfigured } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 200 audio/mpeg from ElevenLabs, or 204 so the client falls back to the browser voice.
export async function POST(req: Request) {
  const blocked = checkPost(req);
  if (blocked) return blocked;
  try {
    const limit = rateLimit(`voice:${anonId(req)}`, LIMITS.voice.max, LIMITS.voice.windowMs);
    if (!limit.ok) return tooMany(limit);
    const body = await readJson<{ text?: unknown }>(req);
    const text = typeof body.text === "string" ? speakable(body.text) : "";
    if (!text || !voiceConfigured()) return new Response(null, { status: 204 });
    try {
      return await synthesize(text);
    } catch (err) {
      logEvent("voice.error", { error: (err as Error).message });
      return new Response(null, { status: 204 });
    }
  } catch (err) {
    return handleError(err);
  }
}
