"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentResult, AnswerMode, ChatTurn, RiskLevel } from "@/lib/types";
import { Avatar } from "../brand";
import { Icon } from "../Icon";
import { AgentAnswer } from "./AgentAnswer";

type Message = { id: string; role: "user"; text: string } | { id: string; role: "assistant"; text: string; result?: AgentResult; error?: boolean };

const THINKING = ["Checking the unlock schedule…", "Reading the news…", "Checking what markets are pricing…", "Running the compliance check…"];

const SIGNED_IN_PROMPTS = [
  "I want to buy ARB with ฿5,000",
  "Scan my portfolio",
  "What's moving Bitcoin this week?",
  "Is AVAX risky right now?",
];
const PUBLIC_PROMPTS = ["What is U-Guard?", "Is ARB risky right now?", "What's the chance the Fed hikes in October?", "Is this investment advice?"];

function worstLevel(result?: AgentResult): RiskLevel | null {
  const order: RiskLevel[] = ["high", "medium", "low", "none"];
  const levels = result?.cards.map((c) => c.level) ?? [];
  return order.find((l) => levels.includes(l)) ?? null;
}

function useAnswerMode(): [AnswerMode, (m: AnswerMode) => void] {
  const [mode, setMode] = useState<AnswerMode>("beginner");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ug_mode");
      if (saved === "pro" || saved === "beginner") setMode(saved);
    } catch {
      // storage can be unavailable (private mode); the default is fine
    }
  }, []);
  const update = (m: AnswerMode) => {
    setMode(m);
    try {
      localStorage.setItem("ug_mode", m);
    } catch {
      // ignore
    }
  };
  return [mode, update];
}

export function ChatPanel({
  variant,
  signedIn,
  userName,
  autoFocus = false,
}: {
  variant: "full" | "popup";
  signedIn: boolean;
  userName?: string | null;
  autoFocus?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useAnswerMode();
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!busy) return;
    setStep(0);
    const id = setInterval(() => setStep((s) => (s + 1) % THINKING.length), 900);
    return () => clearInterval(id);
  }, [busy]);

  useEffect(() => {
    if (messages.length === 0) return;
    if (variant === "popup") {
      // Show the start of the newest message (an answer can be taller than the sheet).
      const box = scrollRef.current;
      const last = messages[messages.length - 1];
      const el = document.getElementById(`m-${last.id}`);
      if (box && el) box.scrollTo({ top: el.offsetTop - box.offsetTop - 8, behavior: "smooth" });
    } else {
      const last = messages[messages.length - 1];
      // Bring a new question into view; for answers, show their top (the reply text).
      document.getElementById(`m-${last.id}`)?.scrollIntoView({ behavior: "smooth", block: last.role === "user" ? "end" : "start" });
    }
  }, [messages, variant]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      const history: ChatTurn[] = messages
        .filter((m) => !(m.role === "assistant" && m.error))
        .slice(-8)
        .map((m) => ({ role: m.role, text: m.text }));
      const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: message };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setBusy(true);
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message, history, mode }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "U-Bot is unavailable right now.");
        const result = body as AgentResult;
        setMessages((prev) => [...prev, { id: result.requestId, role: "assistant", text: result.reply, result }]);
      } catch (err) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", text: (err as Error).message, error: true }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, mode],
  );

  const lastResult = [...messages].reverse().find((m) => m.role === "assistant" && "result" in m && m.result) as
    | { result?: AgentResult }
    | undefined;
  const prompts = signedIn ? SIGNED_IN_PROMPTS : PUBLIC_PROMPTS;
  const compact = variant === "popup";

  const header = (
    <div className="chat-head">
      <div className="who">
        <Avatar level={worstLevel(lastResult?.result)} thinking={busy} />
        <div style={{ minWidth: 0 }}>
          <strong>U-Bot</strong>
          <span>U-topia&apos;s assistant · demo</span>
        </div>
        <span className="skill-pill" title="U-Guard checks unlocks, news and market odds before your money moves">
          <Icon name="shield" size={12} /> U-Guard on
        </span>
      </div>
      <div className="segmented" role="group" aria-label="Answer style">
        <button type="button" aria-pressed={mode === "beginner"} onClick={() => setMode("beginner")}>
          Beginner
        </button>
        <button type="button" aria-pressed={mode === "pro"} onClick={() => setMode("pro")}>
          Pro
        </button>
      </div>
    </div>
  );

  const empty = (
    <div className="stack" style={{ padding: compact ? "4px 0" : "18px 0", gap: 14 }}>
      <div className="msg msg-bot">
        <Avatar />
        <div className="body">
          <div className="bubble">
            {signedIn
              ? `Hi${userName ? ` ${userName}` : ""}! I'm U-Bot. Before your money moves, my U-Guard skill checks token unlocks, the news and what markets are pricing. What are you planning?`
              : "Hi! I'm U-Bot, U-topia's assistant. Ask me about U-Guard, or check any token's unlock risk and news before you buy."}
          </div>
        </div>
      </div>
      <div className="suggestions" aria-label="Suggested questions">
        {prompts.map((p) => (
          <button key={p} type="button" className="chip" onClick={() => send(p)}>
            {p}
          </button>
        ))}
      </div>
      {!signedIn ? (
        <p className="dim" style={{ fontSize: 13, margin: 0 }}>
          <Link href="/login">Sign in</Link> to scan your own wallet and approve protection rules.
        </p>
      ) : null}
    </div>
  );

  const list = (
    <div className="messages" aria-live="polite">
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} id={`m-${m.id}`} className="msg msg-user">
            <div className="bubble">{m.text}</div>
          </div>
        ) : (
          <div key={m.id} id={`m-${m.id}`} className="msg msg-bot">
            <Avatar level={worstLevel(m.result)} />
            {m.result ? (
              <AgentAnswer result={m.result} mode={mode} compact={compact} />
            ) : (
              <div className="body">
                <div className="bubble" role="alert">
                  {m.text}
                </div>
              </div>
            )}
          </div>
        ),
      )}
      {busy ? (
        <div className="msg msg-bot">
          <Avatar thinking />
          <div className="thinking" role="status">
            <span className="dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            {THINKING[step]}
          </div>
        </div>
      ) : null}
      <div ref={endRef} />
    </div>
  );

  const composer = (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        send(input);
      }}
    >
      <label htmlFor={`ask-${variant}`} className="sr-only">
        Ask U-Bot
      </label>
      <input
        id={`ask-${variant}`}
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={signedIn ? "Ask before you buy…" : "Ask about any token…"}
        maxLength={600}
        autoComplete="off"
        enterKeyHint="send"
      />
      <button className="send" type="submit" disabled={!input.trim() || busy} aria-label="Send">
        <Icon name="send" size={18} />
      </button>
    </form>
  );

  if (variant === "popup") {
    return (
      <>
        <div className="scroll" ref={scrollRef}>
          {messages.length === 0 ? empty : list}
        </div>
        {composer}
        <p className="foot-note">Information, not investment advice.</p>
      </>
    );
  }

  return (
    <section className="chat card" aria-label="U-Bot chat">
      {header}
      {messages.length === 0 ? empty : list}
      {composer}
    </section>
  );
}
