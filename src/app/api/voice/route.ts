import { z } from "zod";
import { synthesize } from "@/lib/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ text: z.string().trim().min(1).max(800) });

// 200 audio/mpeg from ElevenLabs, or 204 so the browser speaks with its own th-TH voice.
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "text is required" }, { status: 400 });
  const audio = await synthesize(parsed.data.text);
  if (!audio) return new Response(null, { status: 204 });
  return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
