"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";

function speakable(text: string) {
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/\((sample data|ข้อมูลตัวอย่าง)\)/gi, "")
    .replace(/[*_`#>]/g, "")
    .trim();
}

/** Reads an answer aloud: ElevenLabs via /api/voice, or the browser's voice (204 fallback). */
export function VoiceButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const stop = () => {
    audioRef.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setState("idle");
  };

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  async function play() {
    if (state !== "idle") return stop();
    setState("loading");
    const clean = speakable(text);
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (res.status === 200) {
        const blob = await res.blob();
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(blob);
        const audio = new Audio(urlRef.current);
        audioRef.current = audio;
        audio.onended = () => setState("idle");
        await audio.play();
        setState("playing");
        return;
      }
    } catch {
      // fall back to the browser voice below
    }
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = /[฀-๿]/.test(clean) ? "th-TH" : "en-US";
      u.rate = 1.02;
      u.onend = () => setState("idle");
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      setState("playing");
    } else {
      setState("idle");
    }
  }

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={play}
      aria-pressed={state === "playing"}
      aria-label={state === "playing" ? "Stop reading" : "Read the answer aloud"}
      title={state === "playing" ? "Stop" : "Listen"}
    >
      <Icon name={state === "playing" ? "stop" : "speaker"} size={17} />
    </button>
  );
}
