"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Spotlight } from "@/components/fx";
import type { AlertEvent, AlertRule, WatchSummary } from "@/lib/store";
import type { Proposal } from "@/lib/types";

const CHANNEL_TH = { ubot: "U-Bot ในแอป", telegram: "Telegram", line: "LINE" };
const SEV_TH = { high: "สำคัญมาก", medium: "ควรรู้", low: "ทั่วไป" } as const;
const TYPE_TH = { unlock: "Unlock", drift: "พอร์ตห่างจากเป้า", news: "ข่าว" } as const;

type Form = {
  type: AlertRule["type"];
  symbol: string;
  minLevel: "medium" | "high";
  daysBefore: number;
  bandPp: number;
  minSeverity: "medium" | "high";
  channel: AlertRule["channel"];
};

function describe(r: AlertRule): string {
  const who = (s: string) => (s === "*" ? "ทุกเหรียญที่ถือ" : s);
  if (r.type === "unlock") return `${who(r.symbol)} · เสี่ยง${r.minLevel === "high" ? "สูง" : "ปานกลางขึ้นไป"} · ${r.daysBefore} วันก่อน unlock`;
  if (r.type === "drift") return `สัดส่วนห่างจากเป้าเกิน ±${r.bandPp} จุด`;
  return `${who(r.symbol)} · ข่าว${r.minSeverity === "high" ? "สำคัญมาก" : "ระดับควรรู้ขึ้นไป"}`;
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

// Alerts: the rules for when U-Guard speaks up, a manual watch run, and what it sent.
export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [decisions, setDecisions] = useState<Proposal[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [last, setLast] = useState<WatchSummary | null>(null);
  const [running, setRunning] = useState(false);
  const [form, setForm] = useState<Form>({ type: "unlock", symbol: "ARB", minLevel: "medium", daysBefore: 7, bandPp: 5, minSeverity: "high", channel: "ubot" });
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((b) => {
        setRules(b.rules ?? []);
        setDecisions(b.decisions ?? []);
      })
      .catch(() => undefined);
    fetch("/api/watch/events")
      .then((r) => r.json())
      .then((b) => {
        setEvents(b.events ?? []);
        setLast(b.last ?? null);
      })
      .catch(() => undefined);
  };
  useEffect(load, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body =
      form.type === "unlock"
        ? { type: "unlock", symbol: form.symbol, minLevel: form.minLevel, daysBefore: form.daysBefore, channel: form.channel }
        : form.type === "drift"
          ? { type: "drift", bandPp: form.bandPp, channel: form.channel }
          : { type: "news", symbol: form.symbol, minSeverity: form.minSeverity, channel: form.channel };
    const res = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "เพิ่มไม่สำเร็จ");
      return;
    }
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    load();
  }

  async function runNow() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/watch/run", { method: "POST" });
      const body = await res.json();
      if (res.status === 429) setError("เพิ่งตรวจไปเมื่อครู่ รอสักครู่แล้วลองใหม่");
      else if (!res.ok) throw new Error(body.error ?? "ตรวจไม่สำเร็จ");
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <div className="page-title">
        <h1>การแจ้งเตือน</h1>
        <p>U-Guard เฝ้าให้: unlock, ข่าว และพอร์ตที่ห่างจากเป้า · ตรวจอัตโนมัติทุกเช้า 08:00 · ส่งผ่าน U-Bot</p>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={runNow} disabled={running}>
          {running ? "กำลังตรวจ…" : "ตรวจตอนนี้"}
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {last && (
        <Spotlight className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <h2>ผลการตรวจล่าสุด</h2>
            <span className="total">
              {fmtTime(last.ranAt)} · {last.trigger === "cron" ? "อัตโนมัติ" : "กดเอง"} · {last.ms} ms · ตรวจ {last.checked.join(", ") || "–"}
            </span>
          </div>
          {last.fired.length === 0 && last.skipped.length === 0 && <p className="empty">ไม่มีอะไรต้องแจ้ง ทุกอย่างอยู่ในเกณฑ์ที่คุณตั้งไว้</p>}
          {last.fired.map((e) => (
            <div key={e.id} className="event-row" style={{ gridTemplateColumns: "auto 1fr" }}>
              <span className={`sev sev-${e.severity}`}>{SEV_TH[e.severity]}</span>
              <span>
                <b>{e.title}</b>
                <br />
                <small className="note">{e.lines.join(" · ")}</small>
              </span>
            </div>
          ))}
          {last.fired.length > 0 && (
            <p className="note" style={{ margin: "8px 0 0" }}>
              ส่งเข้า U-Bot แล้ว · <Link href="/app">เปิดแอปมือถือ</Link> เพื่อดูการแจ้งเตือนและอนุมัติข้อเสนอ
            </p>
          )}
          {last.skipped.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary className="note">ไม่ได้แจ้ง {last.skipped.length} เรื่อง (ดูเหตุผล)</summary>
              {last.skipped.map((s) => (
                <p key={s.key} className="note" style={{ margin: "6px 0 0" }}>
                  {s.title} · {s.reason}
                </p>
              ))}
            </details>
          )}
        </Spotlight>
      )}

      <div className="grid-2">
        <Spotlight className="panel">
          <div className="panel-head"><h2>กฎแจ้งเตือน</h2></div>
          <form className="form-row" onSubmit={add}>
            <label>
              ประเภท
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Form["type"] })}>
                <option value="unlock">Unlock</option>
                <option value="drift">พอร์ตห่างจากเป้า</option>
                <option value="news">ข่าว</option>
              </select>
            </label>
            {form.type !== "drift" && (
              <label>
                เหรียญ
                <input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} maxLength={20} style={{ width: 90 }} placeholder="* = ทุกเหรียญ" />
              </label>
            )}
            {form.type === "unlock" && (
              <>
                <label>
                  ความเสี่ยงอย่างน้อย
                  <select value={form.minLevel} onChange={(e) => setForm({ ...form, minLevel: e.target.value as Form["minLevel"] })}>
                    <option value="medium">ปานกลาง</option>
                    <option value="high">สูง</option>
                  </select>
                </label>
                <label>
                  ล่วงหน้า (วัน)
                  <input type="number" min={1} max={30} value={form.daysBefore} onChange={(e) => setForm({ ...form, daysBefore: Number(e.target.value) })} style={{ width: 70 }} />
                </label>
              </>
            )}
            {form.type === "drift" && (
              <label>
                ห่างจากเป้าเกิน (จุด)
                <input type="number" min={1} max={50} value={form.bandPp} onChange={(e) => setForm({ ...form, bandPp: Number(e.target.value) })} style={{ width: 70 }} />
              </label>
            )}
            {form.type === "news" && (
              <label>
                ระดับข่าว
                <select value={form.minSeverity} onChange={(e) => setForm({ ...form, minSeverity: e.target.value as Form["minSeverity"] })}>
                  <option value="high">สำคัญมากเท่านั้น</option>
                  <option value="medium">ควรรู้ขึ้นไป</option>
                </select>
              </label>
            )}
            <label>
              ช่องทาง
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Form["channel"] })}>
                <option value="ubot">U-Bot ในแอป</option>
                <option value="telegram">Telegram (roadmap)</option>
                <option value="line">LINE (roadmap)</option>
              </select>
            </label>
            <button className="btn btn-primary" type="submit">เพิ่ม</button>
          </form>
          <div style={{ marginTop: 14 }}>
            {rules.length === 0 && <p className="empty">ยังไม่มีกฎ ลองเพิ่มด้านบน</p>}
            {rules.map((r) => (
              <div key={r.id} className="event-row" style={{ gridTemplateColumns: "auto 1fr auto" }}>
                <span className="pill">{TYPE_TH[r.type]}</span>
                <span>
                  {describe(r)} · {CHANNEL_TH[r.channel]}
                </span>
                <button className="btn btn-sm" onClick={() => remove(r.id)}>ลบ</button>
              </div>
            ))}
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            กันแจ้งซ้ำ · ช่วง 22:00–07:00 แจ้งเฉพาะเรื่องสำคัญมาก · ไม่เกิน 5 ครั้งต่อวัน · ข่าวสำคัญมากต้องมาจากแหล่งที่เชื่อถือได้หรือมีแหล่งที่สองยืนยัน
          </p>
        </Spotlight>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <Spotlight className="panel">
            <div className="panel-head"><h2>ประวัติการแจ้งเตือน</h2></div>
            {events.length === 0 && <p className="empty">ยังไม่มี กด &ldquo;ตรวจตอนนี้&rdquo; เพื่อลอง</p>}
            {events.map((e) => (
              <div key={e.id} className="event-row" style={{ gridTemplateColumns: "auto 1fr" }}>
                <span className={`sev sev-${e.severity}`}>{SEV_TH[e.severity]}</span>
                <span>
                  {e.title}
                  <br />
                  <small className="note">
                    {fmtTime(e.firedAt)} · {CHANNEL_TH[e.channel]}
                    {e.url && (
                      <>
                        {" "}·{" "}
                        <a href={e.url} target="_blank" rel="noreferrer noopener">
                          แหล่งข่าว
                        </a>
                      </>
                    )}
                  </small>
                </span>
              </div>
            ))}
          </Spotlight>
          <Spotlight className="panel">
            <div className="panel-head"><h2>การตัดสินใจที่บันทึกไว้</h2><span className="total">อนุมัติ / ไม่อนุมัติ</span></div>
            {decisions.length === 0 && <p className="empty">ยังไม่มี ลองอนุมัติข้อเสนอในหน้า AI Agent หรือแอปมือถือ</p>}
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
      </div>
    </>
  );
}
