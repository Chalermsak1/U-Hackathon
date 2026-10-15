"use client";

import { useState } from "react";
import { compact, LEVEL_TH, pct, sourceLabelTh, thaiDate, usd } from "@/lib/format";
import type { Proposal, ProtectionReceipt, RecipientClass, RiskCard } from "@/lib/types";

const RECIPIENT: Record<RecipientClass, { th: string; color: string }> = {
  team: { th: "ทีม", color: "#FB7151" },
  investor: { th: "นักลงทุน", color: "#FBBF24" },
  community: { th: "ชุมชน", color: "#94A3B8" },
  other: { th: "อื่นๆ", color: "#64748B" },
  reserve: { th: "เงินสำรอง", color: "#A78BFA" },
  ecosystem: { th: "กองทุน ecosystem", color: "#2DD4BF" },
};

async function speak(text: string) {
  const res = await fetch("/api/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch(() => null);
  if (res && res.status === 200) {
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
    return;
  }
  // Fallback: the browser's own Thai voice.
  if ("speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
}

export function RiskCardView({ card }: { card: RiskCard }) {
  const [speaking, setSpeaking] = useState(false);
  const hasUnlock = card.level !== "none";
  const script = `${card.name} ${LEVEL_TH[card.level]} คะแนน ${card.score} จาก 100. ${card.reasons.join(" ")}`;

  return (
    <article className={`card lv-${card.level}`} aria-label={`การ์ดความเสี่ยง ${card.symbol}`}>
      <div className="card-head">
        <h3>{card.symbol}</h3>
        <span className="name">{card.name}</span>
        <span className="pill">
          <span className="dot" />
          {LEVEL_TH[card.level]}
        </span>
        {hasUnlock && <span className="score">{card.score}/100</span>}
      </div>
      {hasUnlock && (
        <>
          <div className="meter" aria-hidden="true">
            <i style={{ width: `${Math.max(4, card.score)}%` }} />
          </div>
          <div className="stats">
            <div className="stat">
              <b>{pct(card.pctOfCirculating)}</b>
              <span>ของเหรียญหมุนเวียน</span>
            </div>
            <div className="stat">
              <b>{card.daysOfVolume === null ? "–" : `${card.daysOfVolume.toFixed(2)} วัน`}</b>
              <span>เทียบ volume ซื้อขาย</span>
            </div>
            <div className="stat">
              <b>{usd(card.valueUsd)}</b>
              <span>
                {compact(card.amount)} {card.symbol} · {card.timing === "continuous" ? "ทยอยปลดล็อก 30 วัน" : card.unlockDate ? thaiDate(card.unlockDate) : ""}
              </span>
            </div>
          </div>
        </>
      )}
      <ul className="reasons">
        {card.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {card.breakdown.length > 0 && (
        <>
          <div className="split" aria-hidden="true">
            {card.breakdown.map((b) => (
              <i key={b.name} style={{ width: `${b.share * 100}%`, background: RECIPIENT[b.recipient].color }} />
            ))}
          </div>
          <div className="legend">
            {card.breakdown.map((b) => (
              <span key={b.name}>
                <i style={{ background: RECIPIENT[b.recipient].color }} />
                {RECIPIENT[b.recipient].th} {Math.round(b.share * 100)}%
              </span>
            ))}
          </div>
        </>
      )}
      <div className="card-foot">
        <span>
          Tokenomist · {sourceLabelTh(card.source.mode)} · ไม่ใช่คำแนะนำการลงทุน
        </span>
        <button
          className="btn btn-sm"
          disabled={speaking}
          onClick={async () => {
            setSpeaking(true);
            await speak(script).catch(() => undefined);
            setSpeaking(false);
          }}
        >
          {speaking ? "กำลังอ่าน…" : "ฟังสรุป"}
        </button>
      </div>
    </article>
  );
}

export function ProposalCardView({ proposal }: { proposal: Proposal }) {
  const [state, setState] = useState<"pending" | "busy" | "approved" | "declined">("pending");
  const [receipt, setReceipt] = useState<ProtectionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "decline") {
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/protect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id, decision }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong");
      setReceipt(body.receipt ?? null);
      setState(decision === "approve" ? "approved" : "declined");
    } catch (err) {
      setError((err as Error).message);
      setState("pending");
    }
  }

  return (
    <article className="proposal" aria-label="ข้อเสนอการป้องกัน">
      <h4>{proposal.title}</h4>
      <p>{proposal.detail}</p>
      {state === "approved" && receipt && (
        <p className="receipt">
          อนุมัติแล้ว · บันทึกบน {receipt.chain}
          {receipt.explorerUrl ? (
            <>
              {" "}
              ·{" "}
              <a href={receipt.explorerUrl} target="_blank" rel="noreferrer">
                ดูธุรกรรม {receipt.txHash?.slice(0, 10)}…
              </a>
            </>
          ) : (
            <> · {receipt.note}</>
          )}
        </p>
      )}
      {state === "declined" && <p className="receipt">ไม่ตั้งการป้องกัน U-Guard จะไม่ทำอะไรเพิ่ม</p>}
      {(state === "pending" || state === "busy") && (
        <div className="row">
          <button className="btn btn-primary" disabled={state === "busy"} onClick={() => decide("approve")}>
            {state === "busy" ? "กำลังบันทึก…" : "อนุมัติ"}
          </button>
          <button className="btn" disabled={state === "busy"} onClick={() => decide("decline")}>
            ไม่ต้อง
          </button>
          {error && <span className="error">{error}</span>}
        </div>
      )}
    </article>
  );
}
