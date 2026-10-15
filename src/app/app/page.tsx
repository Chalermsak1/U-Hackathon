"use client";

import { useEffect, useState } from "react";
import { Avatar, topLevel } from "@/components/Avatar";
import { RiskCardView } from "@/components/Cards";
import { ChatThread } from "@/components/ChatThread";
import { MicButton } from "@/components/MicButton";
import { Ticker } from "@/components/Ticker";
import { TopBar } from "@/components/TopBar";
import { TracePanel } from "@/components/TracePanel";
import { useAgentChat } from "@/components/useAgentChat";
import { sourceLabelTh, thb } from "@/lib/format";
import { openReport } from "@/lib/report";
import type { Holding } from "@/lib/types";

const SUGGESTIONS = ["ซื้อ ARB 5,000 บาท", "AVAX น่ากังวลไหม", "WLD มี unlock ไหม", "สแกนพอร์ตของฉัน"];

// The U-topia phone view: wallet + U-Bot chat, with Agent Trace and a large latest-result panel.
export default function AppPage() {
  const { messages, busy, error, setError, levels, last, ask, scan, questionFor } = useAgentChat();
  const [input, setInput] = useState("");
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalThb, setTotalThb] = useState(0);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((b) => {
        setHoldings(b.holdings ?? []);
        setTotalThb(b.totalThb ?? 0);
      })
      .catch(() => undefined);
  }, []);

  const send = (text: string) => {
    setInput("");
    ask(text);
  };
  const modes = messages.flatMap((m) => m.result?.cards.map((c) => c.source.mode) ?? []);
  const dataMode = modes.includes("live") ? "live" : modes.includes("snapshot") ? "snapshot" : "sample";

  return (
    <>
      <TopBar current="app">
        {last && (
          <span className="pill" title="ใครตอบคำถามล่าสุด">
            Agent: {last.engine}
          </span>
        )}
        <span className={`pill ${dataMode === "sample" ? "lv-medium" : "lv-low"}`}>
          {sourceLabelTh(dataMode)}
        </span>
      </TopBar>
      <div className="ticker-wrap">
        <Ticker onPick={(s) => send(`เช็ก ${s} ให้หน่อย`)} />
      </div>

      <main className="app-grid">
        <section className="phone" aria-label="แอป U-topia">
          <div className="phone-status">
            <span>U-topia</span>
            <span className="mono">9:41</span>
          </div>

          <div className="wallet">
            <div className="wallet-top">
              <div>
                <div className="wallet-label">ยอดรวมในกระเป๋า</div>
                <div className="wallet-total">{thb(totalThb)}</div>
              </div>
              <button className="btn btn-sm" onClick={scan} disabled={busy}>
                สแกนพอร์ต
              </button>
            </div>
            <ul className="holdings" aria-label="เหรียญในกระเป๋า">
              {holdings.map((h) => {
                const lv = levels[h.symbol];
                const flagged = lv === "high" || lv === "medium";
                return (
                  <li key={h.symbol}>
                    <button
                      className={`holding ${lv ? `lv-${lv}` : ""}`}
                      onClick={() => send(`เช็ก ${h.symbol} ที่ฉันถืออยู่`)}
                      disabled={busy}
                      title={`${h.name}: ${h.amount.toLocaleString("en-US")} ${h.symbol}`}
                    >
                      <span className="holding-sym">
                        {flagged && <span className="dot" aria-label="มี unlock ที่ต้องระวัง" />}
                        {h.symbol}
                      </span>
                      <span className="holding-val">{thb(h.valueThb)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="chat">
            <div className="chat-head">
              <Avatar size={30} thinking={busy} level={topLevel(Object.values(levels))} />
              <div>
                <p>U-Bot · U-Guard</p>
                <span>{busy ? "กำลังตรวจสอบ…" : "เช็กความเสี่ยงก่อนเงินขยับ"}</span>
              </div>
            </div>

            <ChatThread messages={messages} busy={busy} questionFor={questionFor} />

            {error && (
              <p className="error" style={{ padding: "0 14px" }}>
                {error}
              </p>
            )}
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => (s.startsWith("สแกน") ? scan() : send(s))} disabled={busy}>
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
              <label htmlFor="ask" className="sr-only">
                ถาม U-Guard
              </label>
              <input
                id="ask"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="ซื้อ ARB 5,000 บาท"
                autoComplete="off"
                maxLength={500}
              />
              <MicButton onText={send} onError={setError} disabled={busy} />
              <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
                ส่ง
              </button>
            </form>
          </div>
        </section>

        <aside className="side">
          {last && last.result.cards.length > 0 && (
            <section className="panel spotlight" aria-label="ผลล่าสุด">
              <div className="panel-head">
                <h2>ผลล่าสุด</h2>
                <span className="total">ขยายจากแชตสำหรับจอใหญ่</span>
                <button
                  className="btn btn-sm"
                  onClick={() => openReport([...messages].reverse().find((m) => m.role === "user")?.text ?? "สแกนพอร์ต", last.result)}
                >
                  PDF
                </button>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {last.result.cards.map((c) => (
                  <RiskCardView key={c.symbol} card={c} />
                ))}
              </div>
            </section>
          )}
          <TracePanel last={last} />

          <section className="panel" aria-label="U-Guard ทำงานอย่างไร">
            <div className="panel-head">
              <h2>U-Guard ทำงานอย่างไร</h2>
            </div>
            <div className="steps">
              <div>
                <b>1. ดึงข้อมูล</b>ตาราง unlock, ผู้รับ, รอบระดมทุน จาก Tokenomist
              </div>
              <div>
                <b>2. คำนวณด้วยโค้ด</b>ขนาด, สภาพคล่อง, ประเภทผู้รับ ตามงานวิจัย Keyrock
              </div>
              <div>
                <b>3. คุณตัดสินใจ</b>อนุมัติแล้วบันทึกกฎบน Avalanche
              </div>
            </div>
            <p className="note" style={{ marginTop: 10 }}>
              U-Guard ไม่ทายราคาและไม่แนะนำให้ซื้อหรือขาย ทุกตัวเลขมาจากแหล่งข้อมูลพร้อมวันที่
            </p>
          </section>
        </aside>
      </main>
    </>
  );
}
