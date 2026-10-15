"use client";

import { useEffect, useState } from "react";
import { Spotlight } from "@/components/fx";
import { INBOX_EVENT, InboxList, useInbox } from "@/components/UBotInbox";
import type { Proposal } from "@/lib/types";

interface Outcome {
  ruleId: string;
  symbol: string;
  fired: boolean;
  reason: string;
  channelNote?: string;
}

interface Rule {
  id: string;
  createdAt: string;
  symbol: string;
  minLevel: "medium" | "high";
  daysBefore: number;
  channel: "ubot" | "telegram" | "line";
}

const CHANNEL_TH = { ubot: "U-Bot ในแอป", telegram: "Telegram", line: "LINE" };

// Smart alerts: rules for when U-Guard should speak up, and the protection decisions so far.
export default function AlertsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [decisions, setDecisions] = useState<Proposal[]>([]);
  const [form, setForm] = useState({ symbol: "ARB", minLevel: "medium", daysBefore: 7, channel: "ubot" });
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const inbox = useInbox();
  const [watch, setWatch] = useState<{ enabled: boolean; intervalMin: number; lastRun: string | null; lastFired: number } | null>(null);
  const [adding, setAdding] = useState(false);

  const load = () =>
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((b) => {
        setRules(b.rules ?? []);
        setDecisions(b.decisions ?? []);
      })
      .catch(() => undefined);
  useEffect(() => {
    load();
    const loadWatch = () =>
      fetch("/api/watch")
        .then((r) => (r.ok ? r.json() : null))
        .then(setWatch)
        .catch(() => undefined);
    loadWatch();
    const t = setInterval(loadWatch, 30_000);
    return () => clearInterval(t);
  }, []);

  // One tap: a rule for every token in the wallet (stablecoins skipped), then check right away.
  async function watchWallet() {
    setAdding(true);
    setError(null);
    try {
      const b = await fetch("/api/portfolio").then((r) => r.json());
      const have = new Set(rules.map((r) => r.symbol));
      const syms: string[] = (b.holdings ?? []).map((h: { symbol: string }) => h.symbol).filter((x: string) => !["USDC", "USDT", "DAI"].includes(x) && !have.has(x));
      for (const symbol of syms) {
        await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, minLevel: "medium", daysBefore: 7, channel: "ubot" }),
        });
      }
      await load();
      await checkNow();
    } finally {
      setAdding(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "เพิ่มไม่สำเร็จ");
      return;
    }
    load();
  }

  // Check every rule now: the ones that fire are pushed into the U-Bot inbox.
  async function checkNow() {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "ตรวจไม่สำเร็จ");
      setOutcomes(body.outcomes ?? []);
      if (body.fired > 0) window.dispatchEvent(new Event(INBOX_EVENT));
      inbox.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="page-title">
        <h1>การแจ้งเตือน</h1>
        <p>ให้ U-Guard บอกเฉพาะเรื่องที่สำคัญ · ส่งผ่าน U-Bot (Telegram / LINE เป็น roadmap)</p>
      </div>
      <div className="grid-2">
        <Spotlight className="panel">
          <div className="watch-bar">
            <span className={`watch-dot ${watch?.enabled ? "on" : ""}`} aria-hidden="true" />
            <span>
              {watch?.enabled
                ? `U-Bot เฝ้าดูอัตโนมัติทุก ${watch.intervalMin} นาที`
                : "การเฝ้าดูอัตโนมัติปิดอยู่ (ตั้ง WATCH_INTERVAL_MIN หรือใช้ cron)"}
              {watch?.lastRun && (
                <small className="note">
                  {" "}· ตรวจล่าสุด {new Date(watch.lastRun).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} · เตือน {watch.lastFired}
                </small>
              )}
            </span>
            <button className="btn btn-sm" onClick={watchWallet} disabled={adding || checking}>
              {adding ? "กำลังตั้ง…" : "เฝ้าดูทุกเหรียญในพอร์ต"}
            </button>
          </div>
          <div className="panel-head"><h2>สร้างกฎแจ้งเตือน</h2></div>
          <form className="form-row" onSubmit={add}>
            <label>
              เหรียญ
              <input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} maxLength={20} style={{ width: 90 }} />
            </label>
            <label>
              เมื่อความเสี่ยงอย่างน้อย
              <select value={form.minLevel} onChange={(e) => setForm({ ...form, minLevel: e.target.value })}>
                <option value="medium">ปานกลาง</option>
                <option value="high">สูง</option>
              </select>
            </label>
            <label>
              ล่วงหน้า (วัน)
              <input type="number" min={1} max={30} value={form.daysBefore} onChange={(e) => setForm({ ...form, daysBefore: Number(e.target.value) })} style={{ width: 80 }} />
            </label>
            <label>
              ช่องทาง
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                <option value="ubot">U-Bot ในแอป</option>
                <option value="telegram">Telegram</option>
                <option value="line">LINE</option>
              </select>
            </label>
            <button className="btn btn-primary" type="submit">เพิ่ม</button>
          </form>
          {error && <p className="error">{error}</p>}
          <div style={{ marginTop: 14 }}>
            {rules.length === 0 && <p className="empty">ยังไม่มีกฎ ลองเพิ่ม ARB ด้านบน</p>}
            {rules.map((r) => {
              const o = outcomes?.find((x) => x.ruleId === r.id);
              return (
                <div key={r.id} className="event-row" style={{ gridTemplateColumns: "1fr auto" }}>
                  <span>
                    <b>{r.symbol}</b> · แจ้งเมื่อเสี่ยง{r.minLevel === "high" ? "สูง" : "ปานกลางขึ้นไป"} · {r.daysBefore} วันก่อน unlock · {CHANNEL_TH[r.channel]}
                    {o && (
                      <span className={`note alert-outcome ${o.fired ? "fired" : ""}`}>
                        {o.fired ? "✓ ส่งเข้า U-Bot แล้ว · " : "ไม่เตือน · "}
                        {o.reason}
                        {o.channelNote ? ` · ${o.channelNote}` : ""}
                      </span>
                    )}
                  </span>
                  <button className="btn btn-sm" onClick={() => remove(r.id)}>ลบ</button>
                </div>
              );
            })}
          </div>
          {rules.length > 0 && (
            <div className="row" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
              <button className="btn btn-primary" onClick={checkNow} disabled={checking}>
                {checking ? "กำลังตรวจ…" : "ตรวจตอนนี้"}
              </button>
              <span className="note">เช็กทุกกฎกับข้อมูลล่าสุด ข้อไหนเข้าเงื่อนไขจะส่งเข้า U-Bot (เตือนซ้ำได้หลัง 12 ชม.)</span>
            </div>
          )}
        </Spotlight>
        <Spotlight className="panel">
          <div className="panel-head"><h2>ข้อความจาก U-Bot</h2><span className="total">ล่าสุดก่อน</span></div>
          <InboxList items={inbox.items.slice(0, 6)} />
        </Spotlight>
        <Spotlight className="panel">
          <div className="panel-head"><h2>การตัดสินใจที่บันทึกไว้</h2><span className="total">อนุมัติ / ไม่อนุมัติ</span></div>
          {decisions.length === 0 && <p className="empty">ยังไม่มี ลองอนุมัติข้อเสนอในหน้า AI Agent, เทรด หรือ ลงทุน</p>}
          {decisions.map((d) => (
            <div key={d.id} className="event-row" style={{ gridTemplateColumns: "1fr auto" }}>
              <span>
                <b>{d.symbol}</b> · {d.title}
              </span>
              <span className={`pill ${d.status === "approved" ? "lv-low" : "lv-none"}`}>{d.status === "approved" ? "อนุมัติ" : "ไม่อนุมัติ"}</span>
            </div>
          ))}
        </Spotlight>
      </div>
    </>
  );
}
