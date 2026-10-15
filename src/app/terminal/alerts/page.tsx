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
  type?: "unlock" | "drift" | "news";
  symbol: string;
  minLevel: "medium" | "high";
  daysBefore: number;
  channel: "ubot" | "telegram" | "line";
}

const CHANNEL_TH = { ubot: "U-Bot ในแอป", telegram: "Telegram", line: "LINE" };
const TYPE_TH = { unlock: "Unlock", drift: "พอร์ตเบี้ยวจากเป้า", news: "ข่าวลบ" };

interface AlertEvent {
  id: string;
  type: "unlock" | "drift" | "news";
  symbol: string;
  severity: "high" | "medium";
  firedAt: string;
  title: string;
  url?: string;
}

interface WatchInfo {
  enabled: boolean;
  intervalMin: number;
  lastRun: string | null;
  lastFired: number;
  quietHours?: { start: number; end: number };
  maxPerDay?: number;
  last?: { ranAt: string; skipped: { title: string; reason: string }[] } | null;
  events?: AlertEvent[];
}

const hhmm = (iso: string) => new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function ruleText(r: Rule): string {
  const who = r.symbol === "*" ? "ทุกเหรียญในพอร์ต" : r.symbol;
  if (r.type === "drift") return `พอร์ตเบี้ยวเกินกรอบจากเป้าที่ตั้งไว้ · ${CHANNEL_TH[r.channel]}`;
  if (r.type === "news") return `ข่าวลบของ ${who} · ระดับ${r.minLevel === "high" ? "รุนแรง" : "ปานกลางขึ้นไป"} · ${CHANNEL_TH[r.channel]}`;
  return `unlock ของ ${who} · เสี่ยง${r.minLevel === "high" ? "สูง" : "ปานกลางขึ้นไป"} · ${r.daysBefore} วันก่อน · ${CHANNEL_TH[r.channel]}`;
}

// Smart alerts: rules for when U-Guard should speak up, and the protection decisions so far.
export default function AlertsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [decisions, setDecisions] = useState<Proposal[]>([]);
  const [form, setForm] = useState({ type: "unlock", symbol: "ARB", minLevel: "medium", daysBefore: 7, channel: "ubot" });
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null);
  const inbox = useInbox();
  const [watch, setWatch] = useState<WatchInfo | null>(null);
  const [adding, setAdding] = useState(false);

  const load = () =>
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((b) => {
        setRules(b.rules ?? []);
        setDecisions(b.decisions ?? []);
      })
      .catch(() => undefined);
  const loadWatch = () =>
    fetch("/api/watch")
      .then((r) => (r.ok ? r.json() : null))
      .then(setWatch)
      .catch(() => undefined);
  useEffect(() => {
    load();
    loadWatch();
    const t = setInterval(loadWatch, 30_000);
    return () => clearInterval(t);
  }, []);

  // One tap: unlock + drift + news rules for every token in the wallet, then check right away.
  async function watchWallet() {
    setAdding(true);
    setError(null);
    try {
      for (const rule of [
        { type: "unlock", symbol: "*", minLevel: "medium", daysBefore: 7, channel: "ubot" },
        { type: "drift", symbol: "*", minLevel: "medium", daysBefore: 7, channel: "ubot" },
        { type: "news", symbol: "*", minLevel: "medium", daysBefore: 7, channel: "ubot" },
      ]) {
        await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rule) });
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
      loadWatch();
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
              {watch?.quietHours && (
                <small className="note" style={{ display: "block" }}>
                  ช่วง {watch.quietHours.start}:00–{watch.quietHours.end}:00 แจ้งเฉพาะเรื่องเสี่ยงสูง · ไม่เกิน {watch.maxPerDay} ครั้งต่อวัน · ไม่แจ้งซ้ำเรื่องเดิม
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
              ประเภท
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="unlock">Unlock</option>
                <option value="drift">พอร์ตเบี้ยวจากเป้า</option>
                <option value="news">ข่าวลบ</option>
              </select>
            </label>
            {form.type !== "drift" && (
              <label>
                เหรียญ (* = ทั้งพอร์ต)
                <input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} maxLength={20} style={{ width: 90 }} />
              </label>
            )}
            {form.type !== "drift" && (
              <label>
                {form.type === "news" ? "ความรุนแรงอย่างน้อย" : "เมื่อความเสี่ยงอย่างน้อย"}
                <select value={form.minLevel} onChange={(e) => setForm({ ...form, minLevel: e.target.value })}>
                  <option value="medium">ปานกลาง</option>
                  <option value="high">สูง</option>
                </select>
              </label>
            )}
            {form.type === "unlock" && (
              <label>
                ล่วงหน้า (วัน)
                <input type="number" min={1} max={30} value={form.daysBefore} onChange={(e) => setForm({ ...form, daysBefore: Number(e.target.value) })} style={{ width: 80 }} />
              </label>
            )}
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
                    <b>{TYPE_TH[r.type ?? "unlock"]}</b> · {ruleText(r)}
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
              <span className="note">เช็กทุกกฎกับข้อมูลล่าสุด ข้อไหนเข้าเงื่อนไขจะส่งเข้า U-Bot เป็นข้อความเดียว</span>
            </div>
          )}
        </Spotlight>
        <Spotlight className="panel">
          <div className="panel-head"><h2>ข้อความจาก U-Bot</h2><span className="total">ล่าสุดก่อน</span></div>
          <InboxList items={inbox.items.slice(0, 6)} />
        </Spotlight>
        <Spotlight className="panel">
          <div className="panel-head"><h2>ประวัติการแจ้งเตือน</h2><span className="total">{watch?.events?.length ?? 0} รายการ</span></div>
          {(watch?.events ?? []).length === 0 && <p className="empty">ยังไม่มีการแจ้งเตือน</p>}
          {(watch?.events ?? []).map((e) => (
            <div key={e.id} className="event-row" style={{ gridTemplateColumns: "auto 1fr" }}>
              <span className={`pill ${e.severity === "high" ? "lv-high" : "lv-medium"}`}>{TYPE_TH[e.type]}</span>
              <span>
                {e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.title}</a> : e.title}
                <small className="note" style={{ display: "block" }}>{hhmm(e.firedAt)}</small>
              </span>
            </div>
          ))}
          {(watch?.last?.skipped ?? []).length > 0 && (
            <>
              <h4 className="tp-sub" style={{ marginTop: 12 }}>รอบล่าสุดที่ยังไม่ส่ง</h4>
              {watch!.last!.skipped.slice(0, 6).map((s) => (
                <p key={s.title + s.reason} className="note" style={{ margin: "4px 0" }}>
                  {s.title} · <span style={{ color: "var(--amber)" }}>{s.reason}</span>
                </p>
              ))}
            </>
          )}
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
