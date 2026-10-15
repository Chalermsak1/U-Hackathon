"use client";

import { useEffect, useRef, useState } from "react";

// Minimal typing for the browser's (prefixed) Web Speech recognition API.
interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function browserRecognition(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Ask by voice: ElevenLabs Scribe when configured, otherwise the browser's th-TH recognition. */
export function MicButton({
  onText,
  onError,
  disabled,
}: {
  onText: (text: string) => void;
  onError: (message: string | null) => void;
  disabled?: boolean;
}) {
  const [engine, setEngine] = useState<"elevenlabs" | "browser" | "none" | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    fetch("/api/stt")
      .then((r) => r.json())
      .then((b) => setEngine(b.enabled ? "elevenlabs" : browserRecognition() ? "browser" : "none"))
      .catch(() => setEngine(browserRecognition() ? "browser" : "none"));
  }, []);

  async function startElevenLabs() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setState("processing");
      try {
        const form = new FormData();
        form.append("audio", new Blob(chunks, { type: rec.mimeType || "audio/webm" }), "question.webm");
        const res = await fetch("/api/stt", { method: "POST", body: form });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.text) throw new Error(body.error ?? "ฟังไม่ชัด ลองพูดอีกครั้ง");
        onText(body.text);
      } catch (err) {
        onError((err as Error).message);
      } finally {
        setState("idle");
      }
    };
    recorder.current = rec;
    rec.start();
    setState("recording");
  }

  function startBrowser() {
    const Ctor = browserRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "th-TH";
    rec.interimResults = false;
    rec.onresult = (e) => onText(e.results[0][0].transcript);
    rec.onerror = () => onError("ฟังไม่ชัด ลองพูดอีกครั้ง");
    rec.onend = () => setState("idle");
    recognition.current = rec;
    rec.start();
    setState("recording");
  }

  async function toggle() {
    onError(null);
    if (state === "recording") {
      recorder.current?.stop();
      recognition.current?.stop();
      return;
    }
    try {
      if (engine === "elevenlabs") await startElevenLabs();
      else if (engine === "browser") startBrowser();
    } catch {
      onError("เปิดไมค์ไม่ได้ ตรวจสอบสิทธิ์การใช้ไมโครโฟน");
      setState("idle");
    }
  }

  const unavailable = engine === "none";
  return (
    <button
      type="button"
      className={`btn mic ${state === "recording" ? "mic-on" : ""}`}
      onClick={toggle}
      disabled={disabled || unavailable || engine === null || state === "processing"}
      aria-pressed={state === "recording"}
      title={
        unavailable
          ? "เบราว์เซอร์นี้ไม่รองรับการสั่งงานด้วยเสียง"
          : engine === "elevenlabs"
            ? "พูดถาม (ElevenLabs Scribe)"
            : "พูดถาม (ระบบรู้จำเสียงของเบราว์เซอร์)"
      }
    >
      {state === "recording" ? "หยุด" : state === "processing" ? "…" : "พูด"}
    </button>
  );
}
