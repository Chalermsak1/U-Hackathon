"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Avatar, topLevel } from "@/components/Avatar";
import { ChatThread } from "@/components/ChatThread";
import { MicButton } from "@/components/MicButton";
import { speakAloud, stopSpeaking } from "@/components/chat/speak";
import { TracePanel } from "@/components/TracePanel";
import { useAgentChat } from "@/components/useAgentChat";

const SUGGESTIONS = ["Should I buy 5,000 THB of ARB now?", "Scan my portfolio", "How risky is my portfolio?", "Is AVAX worrying?", "What's in the news for my coins?", "Explain FDV simply"];

function AgentInner() {
  const params = useSearchParams();
  const { messages, busy, error, setError, levels, last, ask, scan, questionFor } = useAgentChat();
  const [input, setInput] = useState("");
  const asked = useRef(false);
  // Voice mode: hands-free. Speak → U-Bot answers → the answer is read aloud → the mic opens again.
  const [voice, setVoice] = useState(false);
  const [voiceState, setVoiceState] = useState<"listening" | "speaking" | null>(null);
  const [listenTick, setListenTick] = useState(0);
  const voiceOn = useRef(false);
  const spoken = useRef<string | null>(null);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!voice || busy || !lastMsg || lastMsg.role !== "bot" || lastMsg.id === "welcome" || spoken.current === lastMsg.id) return;
    spoken.current = lastMsg.id;
    setVoiceState("speaking");
    speakAloud(lastMsg.text).then(() => {
      if (!voiceOn.current) return;
      setVoiceState("listening");
      setListenTick((t) => t + 1);
    });
  }, [messages, busy, voice]);

  function toggleVoice() {
    const on = !voice;
    setVoice(on);
    voiceOn.current = on;
    if (on) {
      // Answers already on screen are not read out again.
      spoken.current = messages[messages.length - 1]?.id ?? null;
      setVoiceState("listening");
      setListenTick((t) => t + 1);
    } else {
      stopSpeaking();
      setVoiceState(null);
    }
  }

  // A question passed from the home page or the ⌘K search runs once on arrival.
  useEffect(() => {
    const q = params.get("q");
    if (q && !asked.current) {
      asked.current = true;
      ask(q);
    }
  }, [params, ask]);

  const send = (t: string) => {
    setInput("");
    if (/^scan\b|สแกน/i.test(t)) scan();
    else ask(t);
  };

  return (
    <div className="agent-layout">
      <section className="agent-chat" aria-label="Chat with U-Bot">
        <div className="chat-head">
          <Avatar size={32} thinking={busy} level={topLevel(Object.values(levels))} />
          <div>
            <p>U-Bot · with the U-Guard check</p>
            <span>
              {busy
                ? "U-Guard is calling its tools…"
                : voiceState === "speaking"
                  ? "Voice mode · U-Bot is speaking…"
                  : voiceState === "listening"
                    ? "Voice mode · listening: ask your question"
                    : "U-Bot talks, U-Guard checks the risk, you decide · not investment advice"}
            </span>
          </div>
          <button type="button" className={`btn btn-sm voice-toggle ${voice ? "mic-on" : ""}`} aria-pressed={voice} onClick={toggleVoice} title="Hands-free: speak, hear the answer, speak again">
            {voice ? "Voice mode on" : "Voice mode"}
          </button>
        </div>
        <ChatThread messages={messages} busy={busy} questionFor={questionFor} />
        {error && <p className="error" style={{ padding: "0 14px" }}>{error}</p>}
        <div className="chips">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)} disabled={busy}>
              {s}
            </button>
          ))}
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <label htmlFor="agent-ask" className="sr-only">Ask U-Bot</label>
          <input id="agent-ask" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about a token, your portfolio or unlocks…" autoComplete="off" maxLength={500} />
          <MicButton
            onText={(t) => {
              setVoiceState(null);
              send(t);
            }}
            onError={setError}
            disabled={busy}
            listenWhen={voice ? listenTick : 0}
            handsFree={voice}
          />
          <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>Send</button>
        </form>
      </section>
      <aside style={{ display: "grid", gap: 16 }}>
        <TracePanel last={last} />
      </aside>
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={<p className="note">Loading…</p>}>
      <AgentInner />
    </Suspense>
  );
}
