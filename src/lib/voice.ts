// ElevenLabs voice: text-to-speech (U-Guard reads its answer) and speech-to-text (the
// user asks by voice). Both return null when not configured or on any error; the browser
// then falls back to its own th-TH voice / speech recognition.

import { config } from "./config";

export async function synthesize(text: string): Promise<ArrayBuffer | null> {
  const { apiKey, voiceId, modelId } = config.elevenlabs;
  if (!apiKey || !voiceId) return null;
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: text.slice(0, 600), model_id: modelId }),
      },
    );
    if (!res.ok) {
      console.warn(`[u-guard] ElevenLabs ${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export function sttEnabled(): boolean {
  return Boolean(config.elevenlabs.apiKey);
}

/** Thai speech → text with ElevenLabs Scribe. */
export async function transcribe(audio: Blob, filename: string): Promise<string | null> {
  const { apiKey, sttModelId } = config.elevenlabs;
  if (!apiKey) return null;
  const form = new FormData();
  form.append("model_id", sttModelId);
  form.append("language_code", "th");
  form.append("tag_audio_events", "false");
  form.append("file", audio, filename);
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: form,
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
