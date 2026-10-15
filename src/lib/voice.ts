// ElevenLabs voice (sponsor integration): text-to-speech (U-Guard reads its answer; eleven_v3
// speaks Thai and English) and speech-to-text (the user asks by voice, Scribe). Without a key
// the client falls back to the browser's own voice and speech recognition.

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

export function sttEnabled(): boolean {
  return Boolean(config.elevenlabs.apiKey);
}

/** Speech → text with ElevenLabs Scribe (Thai by default). Null when not configured or on error. */
export async function transcribe(audio: Blob, filename: string, languageCode = "th"): Promise<string | null> {
  const { apiKey, sttModelId } = config.elevenlabs;
  if (!apiKey) return null;
  const form = new FormData();
  form.append("model_id", sttModelId);
  form.append("language_code", languageCode);
  form.append("tag_audio_events", "false");
  form.append("file", audio, filename);
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.warn(`[u-guard] ElevenLabs STT ${res.status}`);
      return null;
    }
    const body = (await res.json()) as { text?: string };
    return body.text?.trim() || null;
  } catch {
    return null;
  }
}
