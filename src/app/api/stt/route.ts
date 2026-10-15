import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { anonId, checkOrigin, tooMany } from "@/lib/http";
import { sttEnabled, transcribe } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

// Tells the client whether to record for ElevenLabs or use the browser's own recognition.
export async function GET() {
  return Response.json({ enabled: sttEnabled() });
}

// multipart/form-data with an "audio" file → { text }. 204 when ElevenLabs isn't configured.
export async function POST(req: Request) {
  const blocked = checkOrigin(req); // multipart, so no JSON content-type check
  if (blocked) return blocked;
  if (!sttEnabled()) return new Response(null, { status: 204 });
  const limit = rateLimit(`stt:${anonId(req)}`, LIMITS.stt.max, LIMITS.stt.windowMs);
  if (!limit.ok) return tooMany(limit);
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: "audio file is required" }, { status: 400 });
  if (audio.size > MAX_BYTES) return Response.json({ error: "audio is longer than this demo accepts" }, { status: 413 });
  const text = await transcribe(audio, "question.webm");
  if (!text) return Response.json({ error: "Couldn't hear that clearly. Try again." }, { status: 502 });
  return Response.json({ text });
}
