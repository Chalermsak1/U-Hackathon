"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DriftCardView } from "@/components/Cards";
import { CountUp, Spotlight } from "@/components/fx";
import { asOfLabelTh } from "@/lib/freshness";
import { LEVEL_TH, thb, unlockWhenTh } from "@/lib/format";
import { openReport, type ReportResult } from "@/lib/report";
import type { DriftReport, Holding, RiskCard } from "@/lib/types";

interface Row extends Holding {
  weightPct: number;
  card: RiskCard | null;
  dilutionPct: number;
}

// Portfolio: weight, unlock risk and 6-month dilution per holding, plus concentration.
export default function PortfolioPage() {
  const [data, setData] = useState<{ rows: Row[]; totalThb: number; atRiskThb: number; topHolding: { symbol: string; weightPct: number } | null } | null>(null);
  const [drift, setDrift] = useState<DriftReport | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [band, setBand] = useState("5");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadTargets = (b: { targets: Record<string, number>; bandPp: number; drift: DriftReport }) => {
    setDrift(b.drift);
    setBand(String(b.bandPp));
    const syms = new Set([...b.drift.rows.map((r) => r.symbol), ...Object.keys(b.targets)]);
    setTargets(Object.fromEntries([...syms].map((s) => [s, String(b.targets[s] ?? 0)])));
  };

  useEffect(() => {
    fetch("/api/portfolio/risk").then((r) => r.json()).then(setData).catch(() => undefined);
    fetch("/api/portfolio/targets").then((r) => (r.ok ? r.json() : null)).then((b) => b && loadTargets(b)).catch(() => undefined);
  }, []);

  // Save the user's own target mix; drift is recomputed against it.
  async function saveTargets(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/portfolio/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: Object.fromEntries(Object.entries(targets).map(([k, v]) => [k, Number(v) || 0])), bandPp: Number(band) || 5 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "บันทึกไม่สำเร็จ");
      loadTargets(body);
      setMsg("บันทึกเป้าแล้ว");
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const sum = Object.values(targets).reduce((s, v) => s + (Number(v) || 0), 0);
  if (!data) return <p className="note">กำลังโหลดพอร์ต…</p>;

  const cards = data.rows.flatMap((r) => (r.card ? [r.card] : []));
  const report = () => {
    const result: ReportResult = {
      reply: `พอร์ตมูลค่า ${thb(data.totalThb)} · มูลค่าที่มี unlock เสี่ยงใน 30 วัน ${thb(data.atRiskThb)}`,
      cards,
      proposals: [],
      trace: [],
    };
    openReport("สรุปความเสี่ยงของพอร์ต", result);
  };
  const concentrated = data.topHolding && data.topHolding.weightPct > 40;

  return (
    <>
      <div className="page-title">
        <h1>พอร์ตของฉัน</h1>
        <p>กระเป๋า U-topia (demo) · AVAX อ่านยอดจริงจาก Avalanche เมื่อตั้ง WALLET_ADDRESS{drift?.pricesAsOf ? ` · ราคา ${asOfLabelTh(drift.pricesAsOf)}` : ""}</p>
        <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={report}>
          สรุปพอร์ตเป็น PDF
        </button>
      </div>
      <div className="kpis">
        <div className="kpi"><span>มูลค่ารวม</span><b><CountUp value={data.totalThb} format={thb} /></b></div>
        <div className="kpi">
          <span>มี unlock เสี่ยงใน 30 วัน</span>
          <b style={{ color: data.atRiskThb ? "var(--coral)" : undefined }}><CountUp value={data.atRiskThb} format={thb} /></b>
          <small>{data.totalThb ? ((data.atRiskThb / data.totalThb) * 100).toFixed(0) : 0}% ของพอร์ต</small>
        </div>
        <div className="kpi">
          <span>เหรียญที่ถือมากที่สุด</span>
          <b>{data.topHolding?.symbol}</b>
          <small style={{ color: concentrated ? "var(--amber)" : undefined }}>
            {data.topHolding?.weightPct.toFixed(0)}% ของพอร์ต{concentrated ? " · กระจุกตัวสูง" : ""}
          </small>
        </div>
      </div>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div>{drift && <DriftCardView drift={drift} />}</div>
        <Spotlight className="panel">
          <div className="panel-head">
            <h2>เป้าสัดส่วนของคุณ</h2>
            <span className="total">รวม {sum}%</span>
          </div>
          <p className="note" style={{ margin: 0 }}>ตั้งเองว่าอยากถือแต่ละเหรียญกี่ % U-Guard จะบอกเมื่อพอร์ตเบี้ยวเกินกรอบ (ไม่ได้บอกให้ซื้อหรือขาย)</p>
          <form onSubmit={saveTargets}>
            <div className="drift-editor">
              {Object.keys(targets).map((s) => (
                <label key={s}>
                  {s} (%)
                  <input inputMode="decimal" value={targets[s]} onChange={(e) => setTargets((t) => ({ ...t, [s]: e.target.value }))} />
                </label>
              ))}
              <label>
                กรอบ (± จุด)
                <input inputMode="decimal" value={band} onChange={(e) => setBand(e.target.value)} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกเป้า"}</button>
              {Math.abs(sum - 100) > 1 && sum !== 0 && <span className="error">ต้องรวมได้ 100%</span>}
              {msg && <span className="note">{msg}</span>}
            </div>
          </form>
        </Spotlight>
      </div>
      <div className="table-wrap">
        <table className="t-table">
          <thead>
            <tr>
              <th>เหรียญ</th>
              <th className="num">จำนวน</th>
              <th className="num">มูลค่า</th>
              <th className="num">สัดส่วน</th>
              <th>Unlock ถัดไป</th>
              <th>ความเสี่ยง</th>
              <th className="num">สัดส่วนลดลงใน 6 เดือน</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.symbol}>
                <td>
                  <Link href={`/terminal/tokens/${r.symbol}`} className="sym">
                    <i>{r.symbol.slice(0, 4)}</i>
                    {r.symbol}
                  </Link>
                </td>
                <td className="num">{r.amount.toLocaleString("en-US")}</td>
                <td className="num">{thb(r.valueThb)}</td>
                <td className="num">{r.weightPct.toFixed(1)}%</td>
                <td>{r.card ? unlockWhenTh(r.card) || "–" : "–"}</td>
                <td>
                  <span className={`pill lv-${r.card?.level ?? "none"}`}>
                    {r.card ? `${LEVEL_TH[r.card.level]}${r.card.level !== "none" ? ` ${r.card.score}` : ""}` : "ไม่มี unlock"}
                  </span>
                </td>
                <td className="num">{r.dilutionPct ? `${r.dilutionPct.toFixed(1)}%` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Spotlight className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h2>อ่านตารางนี้อย่างไร</h2></div>
        <p className="note" style={{ margin: 0 }}>
          &ldquo;สัดส่วนลดลง&rdquo; คือถ้าคุณไม่ซื้อเพิ่ม ส่วนแบ่งของคุณใน supply ที่หมุนเวียนจะเล็กลงเท่าไรจาก unlock ที่ตั้งเวลาไว้แล้ว ·
          ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน
        </p>
      </Spotlight>
    </>
  );
}
