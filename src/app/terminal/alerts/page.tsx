"use client";

import { useEffect, useState } from "react";
import { Spotlight } from "@/components/fx";
import type { Proposal } from "@/lib/types";

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
  }, []);

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
            {rules.map((r) => (
              <div key={r.id} className="event-row" style={{ gridTemplateColumns: "1fr auto" }}>
                <span>
                  <b>{r.symbol}</b> · แจ้งเมื่อเสี่ยง{r.minLevel === "high" ? "สูง" : "ปานกลางขึ้นไป"} · {r.daysBefore} วันก่อน unlock · {CHANNEL_TH[r.channel]}
                </span>
                <button className="btn btn-sm" onClick={() => remove(r.id)}>ลบ</button>
              </div>
            ))}
          </div>
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
    </>
  );
}
