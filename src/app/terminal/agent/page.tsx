"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Avatar, topLevel } from "@/components/Avatar";
import { ChatThread } from "@/components/ChatThread";
import { MicButton } from "@/components/MicButton";
import { TracePanel } from "@/components/TracePanel";
import { useAgentChat } from "@/components/useAgentChat";

const SUGGESTIONS = ["ซื้อ ARB 5,000 บาท", "AVAX น่ากังวลไหม", "WLD มี unlock ไหม", "สแกนพอร์ตของฉัน", "อธิบาย FDV แบบง่ายๆ"];

function AgentInner() {
  const params = useSearchParams();
  const { messages, busy, error, setError, levels, last, ask, scan, questionFor } = useAgentChat();
  const [input, setInput] = useState("");
  const asked = useRef(false);

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
    if (/สแกน/.test(t)) scan();
    else ask(t);
  };

  return (
    <div className="agent-layout">
      <section className="agent-chat" aria-label="แชตกับ U-Guard">
        <div className="chat-head">
          <Avatar size={32} thinking={busy} level={topLevel(Object.values(levels))} />
          <div>
            <p>U-Guard AI Agent</p>
            <span>{busy ? "กำลังเรียก tools…" : "ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน"}</span>
          </div>
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
          <label htmlFor="agent-ask" className="sr-only">ถาม U-Guard</label>
          <input id="agent-ask" value={input} onChange={(e) => setInput(e.target.value)} placeholder="ถามเรื่องเหรียญ พอร์ต หรือ unlock…" autoComplete="off" maxLength={500} />
          <MicButton onText={send} onError={setError} disabled={busy} />
          <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>ส่ง</button>
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
    <Suspense fallback={<p className="note">กำลังโหลด…</p>}>
      <AgentInner />
    </Suspense>
  );
}
