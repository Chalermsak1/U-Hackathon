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

/** Ask by voice: ElevenLabs Scribe when configured, otherwise the browser's own recognition (Thai if the device is set to Thai, else English). */
export function MicButton({
  onText,
  onError,
  disabled,
  listenWhen = 0,
  handsFree = false,
}: {
  onText: (text: string) => void;
  onError: (message: string | null) => void;
  disabled?: boolean;
  /** Voice mode: each new value starts listening without a tap (after U-Bot finished speaking). */
  listenWhen?: number;
  /** Voice mode: stop recording by itself after a pause, instead of waiting for "Stop". */
  handsFree?: boolean;
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
    if (handsFree) stopOnSilence(stream, rec);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setState("processing");
      try {
        const form = new FormData();
        form.append("audio", new Blob(chunks, { type: rec.mimeType || "audio/webm" }), "question.webm");
        const res = await fetch("/api/stt", { method: "POST", body: form });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.text) throw new Error(body.error ?? "Couldn't hear that clearly. Try again.");
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

  /** Ends the recording ~1.4 s after the speaker goes quiet (or after 15 s), for hands-free voice mode. */
  function stopOnSilence(stream: MediaStream, rec: MediaRecorder) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const started = Date.now();
    let heard = false;
    let quietSince = 0;
    const tick = () => {
      if (rec.state !== "recording") return void ctx.close().catch(() => undefined);
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      const loud = Math.sqrt(sum / buf.length) > 0.04;
      if (loud) {
        heard = true;
        quietSince = 0;
      } else if (heard && !quietSince) quietSince = Date.now();
      if ((heard && quietSince && Date.now() - quietSince > 1400) || Date.now() - started > 15_000) {
        rec.stop();
        return void ctx.close().catch(() => undefined);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function startBrowser() {
    const Ctor = browserRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language?.toLowerCase().startsWith("th") ? "th-TH" : "en-US";
    rec.interimResults = false;
    rec.onresult = (e) => onText(e.results[0][0].transcript);
    rec.onerror = () => onError("Couldn't hear that clearly. Try again.");
    rec.onend = () => setState("idle");
    recognition.current = rec;
    rec.start();
    setState("recording");
  }

  // Voice mode: start listening when asked to (each new listenWhen value), if nothing else is going on.
  const startRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (listenWhen > 0) startRef.current();
  }, [listenWhen]);

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
      onError("Couldn't open the mic. Check the microphone permission.");
      setState("idle");
    }
  }

  startRef.current = () => {
    if (state === "idle" && !disabled && engine && engine !== "none") void toggle();
  };

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
          ? "This browser doesn't support voice input"
          : engine === "elevenlabs"
            ? "Ask by voice (ElevenLabs Scribe)"
            : "Ask by voice (browser speech recognition)"
      }
    >
      {state === "recording" ? "Stop" : state === "processing" ? "…" : "Speak"}
    </button>
  );
}
