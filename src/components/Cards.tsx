"use client";

import { useState } from "react";
import { compact, LEVEL_TH, pct, thaiDate, usd } from "@/lib/format";
import { freshLabelTh, isStale, mergeFresh } from "@/lib/freshness";
import type { DriftReport, Freshness, NewsItem, Proposal, ProtectionReceipt, RecipientClass, RiskCard } from "@/lib/types";

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

/** "ข้อมูล Tokenomist ณ 15 ต.ค. 07:00 (ตัวอย่าง) · ราคา ณ ..." with a warning when anything is stale. */
export function FreshLine({ fresh }: { fresh: Freshness[] | undefined }) {
  const list = mergeFresh(fresh ?? []);
  if (list.length === 0) return null;
  const stale = list.filter((f) => isStale(f));
  return (
    <span className={`fresh ${stale.length ? "fresh-stale" : ""}`} title={stale.map((f) => f.note).filter(Boolean).join("\n") || undefined}>
      {stale.length > 0 && <b>อาจไม่ล่าสุด · </b>}
      ข้อมูล {list.map((f) => freshLabelTh(f)).join(" · ")}
    </span>
  );
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
                {compact(card.amount)} {card.symbol} · {card.unlockDate ? thaiDate(card.unlockDate) : ""}
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
          <FreshLine fresh={card.fresh} /> · ไม่ใช่คำแนะนำการลงทุน
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

const DRIFT_TH: Record<DriftReport["rows"][number]["status"], string> = {
  over: "เกินเป้า",
  under: "ต่ำกว่าเป้า",
  ok: "ในกรอบ",
  no_target: "ไม่ได้ตั้งเป้า",
};

/** Current weight vs the user's own target, per token (AGENTIC-WORKFLOW.md §8). */
export function DriftCardView({ drift }: { drift: DriftReport }) {
  const off = drift.rows.filter((r) => r.status === "over" || r.status === "under");
  const scale = Math.max(50, ...drift.rows.map((r) => Math.max(r.weightPct, r.targetPct ?? 0))) * 1.08;
  const level = !drift.hasTargets ? "lv-none" : off.length === 0 ? "lv-low" : drift.totalDriftPct > 10 ? "lv-high" : "lv-medium";
  return (
    <article className={`card drift ${level}`} aria-label="พอร์ตเทียบเป้าหมาย">
      <div className="card-head">
        <h3>พอร์ตเทียบเป้า</h3>
        <span className="name">{drift.hasTargets ? `ห่างจากเป้ารวม ${drift.totalDriftPct}% · กรอบ ±${drift.bandPp} จุด` : "ยังไม่ได้ตั้งเป้าสัดส่วน"}</span>
        <span className="score" title="คะแนนความเสี่ยง unlock ทั้งพอร์ต (ถ่วงตามสัดส่วน)">
          เสี่ยง {drift.portfolioRiskScore}/100
        </span>
      </div>
      <div className="drift-rows">
        {drift.rows.map((r) => (
          <div key={r.symbol} className={`drift-row drift-${r.status}`}>
            <b>{r.symbol}</b>
            <div className="drift-bar" aria-hidden="true">
              <i style={{ width: `${(r.weightPct / scale) * 100}%` }} />
              {r.targetPct !== null && <em style={{ left: `${(r.targetPct / scale) * 100}%` }} />}
            </div>
            <span className="drift-num">
              {r.weightPct}%{r.targetPct !== null ? <small> / {r.targetPct}%</small> : null}
            </span>
            <span className="drift-pp" title={DRIFT_TH[r.status]}>
              {r.driftPp === null ? "–" : `${r.driftPp > 0 ? "+" : ""}${r.driftPp}`}
            </span>
          </div>
        ))}
      </div>
      <ul className="reasons">
        {drift.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <div className="card-foot">
        <span>
          <FreshLine fresh={drift.fresh} /> · เทียบกับเป้าที่คุณตั้งเอง ไม่ใช่คำแนะนำการลงทุน
        </span>
      </div>
    </article>
  );
}

const SEVERITY_TH = { high: "สำคัญมาก", medium: "ควรรู้", low: "ทั่วไป" } as const;

/** Sources for a news answer. Links only to URLs the web search actually returned. */
export function NewsList({ items }: { items: NewsItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="news" aria-label="แหล่งข่าว">
      <h4>แหล่งข่าว</h4>
      <ol>
        {items.map((n) => (
          <li key={`${n.url}|${n.title}`}>
            <span className={`sev sev-${n.severity}`}>{SEVERITY_TH[n.severity]}</span>
            <div>
              {/^https?:\/\//i.test(n.url) ? (
                <a href={n.url} target="_blank" rel="noreferrer noopener">
                  {n.title}
                </a>
              ) : (
                <span>{n.title}</span>
              )}
              <small>
                {n.publisher}
                {n.publishedAt ? ` · ${thaiDate(n.publishedAt)}` : ""} · {n.symbols.join(", ")}
              </small>
              <p>{n.gistTh}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
