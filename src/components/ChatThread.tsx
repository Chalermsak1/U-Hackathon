"use client";

import { useEffect, useRef } from "react";
import { Avatar, topLevel } from "@/components/Avatar";
import { ProposalCardView, RiskCardView } from "@/components/Cards";
import { openReport } from "@/lib/report";
import type { ChatMessage } from "./useAgentChat";

/** The message list: user bubbles, U-Guard answers with risk cards, proposals and a PDF button. */
export function ChatThread({
  messages,
  busy,
  questionFor,
  className = "chat-log",
}: {
  messages: ChatMessage[];
  busy: boolean;
  questionFor: (i: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [messages, busy]);

  return (
    <div className={className} ref={ref} aria-live="polite">
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={m.id} className="msg msg-user">
            <div className="bubble">{m.text}</div>
          </div>
        ) : (
          <div key={m.id} className="msg msg-bot">
            <Avatar size={26} level={topLevel(m.result?.cards.map((c) => c.level) ?? [])} />
            <div className="msg-stack">
              {m.push && <span className="push-tag">U-BOT ALERT</span>}
              <div className="bubble">{m.text}</div>
              {m.result?.cards.map((c) => <RiskCardView key={c.symbol} card={c} />)}
              {m.result?.proposals.map((p) => <ProposalCardView key={p.id} proposal={p} />)}
              {m.result && m.result.cards.length > 0 && (
                <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => openReport(questionFor(i), m.result!)}>
                  Save as PDF
                </button>
              )}
            </div>
          </div>
        ),
      )}
      {busy && (
        <div className="msg msg-bot">
          <Avatar size={26} thinking />
          <div className="bubble note">Fetching the latest data and scoring the risk…</div>
        </div>
      )}
    </div>
  );
}
