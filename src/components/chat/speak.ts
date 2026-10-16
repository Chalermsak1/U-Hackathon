// Speaks a reply aloud and resolves when it has finished: ElevenLabs via /api/voice, or the
// browser's own voice when /api/voice answers 204 (no key). Used by voice mode, which listens
// again only after U-Bot has stopped talking.

let current: { audio?: HTMLAudioElement; url?: string } = {};

export function speakable(text: string): string {
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/\((sample data|ข้อมูลตัวอย่าง)\)/gi, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`#>]/g, "")
    .trim();
}

export function stopSpeaking(): void {
  current.audio?.pause();
  if (current.url) URL.revokeObjectURL(current.url);
  current = {};
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** Reads text aloud; resolves when done, stopped, or after a time limit (some browsers never fire "end"). */
export async function speakAloud(text: string): Promise<void> {
  stopSpeaking();
  const clean = speakable(text).slice(0, 1200);
  if (!clean) return;
  const limit = new Promise<void>((r) => setTimeout(r, Math.min(90_000, 4000 + clean.length * 90)));
  try {
    const res = await fetch("/api/voice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: clean }) });
    if (res.status === 200) {
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      current = { audio, url };
      const ended = new Promise<void>((r) => {
        audio.onended = () => r();
        audio.onerror = () => r();
        audio.onpause = () => r();
      });
      await audio.play();
      return Promise.race([ended, limit]);
    }
  } catch {
    // fall back to the browser voice below
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = /[\u0E00-\u0E7F]/.test(clean) ? "th-TH" : "en-US";
  u.rate = 1.02;
  const ended = new Promise<void>((r) => {
    u.onend = () => r();
    u.onerror = () => r();
  });
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return Promise.race([ended, limit]);
}
