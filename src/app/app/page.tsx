"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, topLevel } from "@/components/Avatar";
import { MicButton } from "@/components/MicButton";
import { ProposalCardView, RiskCardView } from "@/components/Cards";
import { Ticker } from "@/components/Ticker";
import { TopBar } from "@/components/TopBar";
import { thb } from "@/lib/format";
import { openReport } from "@/lib/report";
import type { AgentResult, ChatTurn, Holding, RiskLevel, TraceStep } from "@/lib/types";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  result?: AgentResult;
  push?: boolean;
}

const SUGGESTIONS = ["ซื้อ ARB 5,000 บาท", "AVAX น่ากังวลไหม", "WLD มี unlock ไหม", "สแกนพอร์ตของฉัน"];
const WELCOME: Message = {
  id: "welcome",
  role: "bot",
  text: "สวัสดี ฉันคือ U-Guard ก่อนคุณซื้อหรือถือเหรียญ ฉันจะเช็กให้ว่ามีเหรียญก้อนใหญ่กำลังจะปลดล็อกเข้าตลาดไหม ลองพิมพ์ชื่อเหรียญหรือกดตัวอย่างด้านล่างได้เลย",
};

export default function AppPage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalThb, setTotalThb] = useState(0);
  const [levels, setLevels] = useState<Record<string, RiskLevel>>({});
  const [last, setLast] = useState<{ trace: TraceStep[]; mode: string; ms: number; note?: string; result: AgentResult } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/portfolio")
      .then((r) => r.json())
      .then((b) => {
        setHoldings(b.holdings ?? []);
        setTotalThb(b.totalThb ?? 0);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, busy]);

  const absorb = useCallback((result: AgentResult, ms: number) => {
    setLast({ trace: result.trace, mode: result.mode, ms, note: result.note, result });
    setLevels((prev) => ({ ...prev, ...Object.fromEntries(result.cards.map((c) => [c.symbol, c.level])) }));
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      setError(null);
      setInput("");
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

  const dataMode = messages.some((m) => m.result?.cards.some((c) => c.source.mode === "live")) ? "live" : "sample";

  return (
    <>
      <TopBar current="app">
        {last && (
          <span className="pill" title="ใครตอบคำถามล่าสุด">
            Agent: {last.mode === "claude" ? "Claude" : "Offline"}
          </span>
        )}
        <span className={`pill ${dataMode === "live" ? "lv-low" : "lv-medium"}`}>
          {dataMode === "live" ? "ข้อมูลสด" : "ข้อมูลตัวอย่าง"}
        </span>
      </TopBar>
      <div className="ticker-wrap">
        <Ticker onPick={(s) => ask(`เช็ก ${s} ให้หน่อย`)} />
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
                      onClick={() => ask(`เช็ก ${h.symbol} ที่ฉันถืออยู่`)}
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

            <div className="chat-log" ref={logRef} aria-live="polite">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={m.id} className="msg msg-user">
                    <div className="bubble">{m.text}</div>
                  </div>
                ) : (
                  <div key={m.id} className="msg msg-bot">
                    <Avatar size={26} level={topLevel(m.result?.cards.map((c) => c.level) ?? [])} />
                    <div className="msg-stack">
                      {m.push && <span className="push-tag">U-BOT แจ้งเตือน</span>}
                      <div className="bubble">{m.text}</div>
                      {m.result?.cards.map((c) => <RiskCardView key={c.symbol} card={c} />)}
                      {m.result?.proposals.map((p) => <ProposalCardView key={p.id} proposal={p} />)}
                      {m.result && m.result.cards.length > 0 && (
                        <button
                          className="btn btn-sm"
                          style={{ alignSelf: "flex-start" }}
                          onClick={() => openReport(messages[i - 1]?.role === "user" ? messages[i - 1].text : "สแกนพอร์ต", m.result!)}
                        >
                          สรุปเป็น PDF
                        </button>
                      )}
                    </div>
                  </div>
                ),
              )}
              {busy && (
                <div className="msg msg-bot">
                  <Avatar size={26} thinking />
                  <div className="bubble note">กำลังดึงตาราง unlock และคำนวณความเสี่ยง…</div>
                </div>
              )}
            </div>

            {error && (
              <p className="error" style={{ padding: "0 14px" }}>
                {error}
              </p>
            )}
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => (s.startsWith("สแกน") ? scan() : ask(s))} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
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
              <MicButton onText={(t) => ask(t)} onError={setError} disabled={busy} />
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
                  onClick={() => {
                    const q = [...messages].reverse().find((m) => m.role === "user")?.text ?? "สแกนพอร์ต";
                    openReport(q, last.result);
                  }}
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
          <section className="panel" aria-label="Agent Trace">
            <div className="panel-head">
              <h2>Agent Trace</h2>
              {last && <span className="pill">{last.mode === "claude" ? "Claude" : "Offline agent"}</span>}
              {last && <span className="total">{last.ms} ms</span>}
            </div>
            {last && last.trace.length > 0 ? (
              <ol className="trace">
                {last.trace.map((t, i) => (
                  <li key={`${t.tool}-${i}`} className={t.ok ? undefined : "fail"}>
                    <span>
                      <span className="tool">{t.tool}</span>
                      <br />
                      <span className="sum">{t.summary}</span>
                    </span>
                    <span className="ms">{t.ms} ms</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty">ถามอะไรสักอย่าง แล้วดูว่า agent วางแผนและเรียก tool อะไรบ้าง</p>
            )}
            {last?.note && (
              <p className="note" style={{ marginTop: 10 }}>
                {last.note}
              </p>
            )}
          </section>

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
