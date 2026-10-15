"use client";

import { useCallback, useState } from "react";
import type { AgentResult, ChatTurn, RiskLevel, TraceStep } from "@/lib/types";

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  result?: AgentResult;
  push?: boolean;
}

export interface LastRun {
  trace: TraceStep[];
  mode: string;
  ms: number;
  note?: string;
  result: AgentResult;
}

export const WELCOME: ChatMessage = {
  id: "welcome",
  role: "bot",
  text: "สวัสดี ฉันคือ U-Guard ก่อนคุณซื้อหรือถือเหรียญ ฉันจะเช็กให้ว่ามีเหรียญก้อนใหญ่กำลังจะปลดล็อกเข้าตลาดไหม ลองพิมพ์ชื่อเหรียญหรือกดตัวอย่างด้านล่างได้เลย",
};

/** Chat state shared by the U-topia phone view (/app) and the terminal's AI Agent page. */
export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<Record<string, RiskLevel>>({});
  const [last, setLast] = useState<LastRun | null>(null);

  const absorb = useCallback((result: AgentResult, ms: number) => {
    setLast({ trace: result.trace, mode: result.mode, ms, note: result.note, result });
    setLevels((prev) => ({ ...prev, ...Object.fromEntries(result.cards.map((c) => [c.symbol, c.level])) }));
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      setError(null);
      const history: ChatTurn[] = messages
        .filter((m) => m.id !== "welcome")
        .slice(-8)
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", text: message }]);
      setBusy(true);
      const t0 = performance.now();
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, history }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "U-Guard ตอบไม่ได้ตอนนี้ ลองใหม่อีกครั้ง");
        const result = body as AgentResult;
        absorb(result, Math.round(performance.now() - t0));
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "bot", text: result.reply, result }]);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [busy, messages, absorb],
  );

  const scan = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "สแกนไม่สำเร็จ ลองใหม่อีกครั้ง");
      const result = body as AgentResult & { pushed: boolean };
      absorb(result, Math.round(performance.now() - t0));
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "bot", text: result.reply, result, push: result.pushed }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [busy, absorb]);

  /** The user message that led to bot message i (for the PDF report title). */
  const questionFor = useCallback(
    (i: number) => (messages[i - 1]?.role === "user" ? messages[i - 1].text : "สแกนพอร์ต"),
    [messages],
  );

  return { messages, busy, error, setError, levels, last, ask, scan, questionFor };
}
