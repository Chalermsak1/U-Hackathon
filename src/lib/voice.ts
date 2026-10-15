// ElevenLabs text-to-speech for the answer read-aloud (sponsor integration). eleven_v3
// speaks Thai and English. Without a key the client uses the browser's built-in voice.

import { config } from "./config";

export function voiceConfigured(): boolean {
  return Boolean(config.elevenlabs.apiKey && config.elevenlabs.voiceId);
}

/** What should be spoken: no citation markers, labels or markdown. */
export function speakable(text: string): string {
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/\((sample data|ข้อมูลตัวอย่าง)\)/gi, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

export async function synthesize(text: string): Promise<Response> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.elevenlabs.voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": config.elevenlabs.apiKey, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: config.elevenlabs.modelId }),
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!res.ok || !res.body) throw new Error(`ElevenLabs ${res.status}`);
  return new Response(res.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
}
