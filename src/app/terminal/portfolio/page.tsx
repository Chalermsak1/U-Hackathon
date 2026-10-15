"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DriftCardView } from "@/components/Cards";
import { CountUp, Spotlight } from "@/components/fx";
import { LEVEL_TH, thb, untilText } from "@/lib/format";
import { openReport } from "@/lib/report";
import type { AgentResult, DriftReport, Holding, RiskCard } from "@/lib/types";

interface Row extends Holding {
  weightPct: number;
  card: RiskCard | null;
  dilutionPct: number;
}

// Portfolio: weight, unlock risk and 6-month dilution per holding, plus concentration.
export default function PortfolioPage() {
  const [data, setData] = useState<{
    rows: Row[];
    totalThb: number;
    atRiskThb: number;
    topHolding: { symbol: string; weightPct: number } | null;
    drift: DriftReport;
  } | null>(null);
  const [editing, setEditing] = useState<Record<string, number> | null>(null);
  const [band, setBand] = useState(5);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = () => fetch("/api/portfolio/risk").then((r) => r.json()).then(setData).catch(() => undefined);
  useEffect(() => {
    load();
  }, []);
  if (!data) return <p className="note">กำลังโหลดพอร์ต…</p>;

  const driftOf = (symbol: string) => data.drift.rows.find((r) => r.symbol === symbol);
  const startEdit = () => {
    setSaveError(null);
    setBand(data.drift.bandPp);
    setEditing(Object.fromEntries(data.drift.rows.map((r) => [r.symbol, r.targetPct ?? 0])));
  };
  const editSum = editing ? Object.values(editing).reduce((s, v) => s + v, 0) : 0;
  async function saveTargets() {
    setSaveError(null);
    const res = await fetch("/api/portfolio/targets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets: editing, bandPp: band }),
    });
    if (!res.ok) {
      setSaveError((await res.json().catch(() => ({}))).error ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setEditing(null);
    load();
  }

  const cards = data.rows.flatMap((r) => (r.card ? [r.card] : []));
  const report = () => {
    const result: AgentResult = {
      reply: `พอร์ตมูลค่า ${thb(data.totalThb)} · มูลค่าที่มี unlock เสี่ยงใน 30 วัน ${thb(data.atRiskThb)}\n${data.drift.lines.join("\n")}`,
      cards,
      proposals: [],
      trace: [],
      mode: "offline",
    };
    openReport("สรุปความเสี่ยงของพอร์ต", result);
  };
  const concentrated = data.topHolding && data.topHolding.weightPct > 40;

  return (
    <>
      <div className="page-title">
        <h1>พอร์ตของฉัน</h1>
        <p>กระเป๋า U-topia (demo) · AVAX อ่านยอดจริงจาก Avalanche เมื่อตั้ง WALLET_ADDRESS</p>
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
          <span>ห่างจากเป้าที่คุณตั้ง</span>
          <b style={{ color: data.drift.totalDriftPct > 10 ? "var(--coral)" : data.drift.totalDriftPct > data.drift.bandPp ? "var(--amber)" : undefined }}>
            {data.drift.hasTargets ? `${data.drift.totalDriftPct}%` : "–"}
          </b>
          <small>คะแนนเสี่ยงทั้งพอร์ต {data.drift.portfolioRiskScore}/100</small>
        </div>
        <div className="kpi">
          <span>เหรียญที่ถือมากที่สุด</span>
          <b>{data.topHolding?.symbol}</b>
          <small style={{ color: concentrated ? "var(--amber)" : undefined }}>
            {data.topHolding?.weightPct.toFixed(0)}% ของพอร์ต{concentrated ? " · กระจุกตัวสูง" : ""}
          </small>
        </div>
      </div>
      <div className="table-wrap">
        <table className="t-table">
          <thead>
            <tr>
              <th>เหรียญ</th>
              <th className="num">จำนวน</th>
              <th className="num">มูลค่า</th>
              <th className="num">สัดส่วน</th>
              <th className="num">เป้า</th>
              <th className="num">ห่างจากเป้า</th>
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
                <td className="num">{driftOf(r.symbol)?.targetPct != null ? `${driftOf(r.symbol)!.targetPct}%` : "–"}</td>
                <td className={`num drift-${driftOf(r.symbol)?.status ?? "no_target"}`}>
                  <span className="drift-pp">
                    {driftOf(r.symbol)?.driftPp != null ? `${driftOf(r.symbol)!.driftPp! > 0 ? "+" : ""}${driftOf(r.symbol)!.driftPp}` : "–"}
                  </span>
                </td>
                <td>{r.card?.unlockDate ? untilText(r.card.unlockDate) : "–"}</td>
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
      <div className="grid-2" style={{ marginTop: 16 }}>
        <DriftCardView drift={data.drift} />
        <Spotlight className="panel">
          <div className="panel-head">
            <h2>เป้าสัดส่วนของคุณ</h2>
            {!editing && (
              <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={startEdit}>
                แก้เป้า
              </button>
            )}
          </div>
          {!editing ? (
            <p className="note" style={{ margin: 0 }}>
              U-Guard เทียบพอร์ตกับเป้าที่<b>คุณ</b>ตั้งเอง และเตือนเมื่อห่างเกิน ±{data.drift.bandPp} จุด (หรือเกิน 25% ของเป้า) ไม่ได้บอกว่าควรถืออะไร
            </p>
          ) : (
            <form
              className="targets-form"
              onSubmit={(e) => {
                e.preventDefault();
                saveTargets();
              }}
            >
              {Object.entries(editing).map(([sym, v]) => (
                <label key={sym}>
                  {sym}
                  <input type="number" min={0} max={100} step={1} value={v} onChange={(e) => setEditing({ ...editing, [sym]: Number(e.target.value) })} />
                  <span>%</span>
                </label>
              ))}
              <label>
                กรอบ ±
                <input type="number" min={1} max={50} value={band} onChange={(e) => setBand(Number(e.target.value))} />
                <span>จุด</span>
              </label>
              <p className={`note ${Math.abs(editSum - 100) > 1 ? "error" : ""}`} style={{ margin: 0 }}>
                รวม {editSum}% {Math.abs(editSum - 100) > 1 ? "· ต้องรวมได้ 100%" : ""}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary btn-sm" type="submit" disabled={Math.abs(editSum - 100) > 1}>
                  บันทึก
                </button>
                <button className="btn btn-sm" type="button" onClick={() => setEditing(null)}>
                  ยกเลิก
                </button>
              </div>
              {saveError && <p className="error">{saveError}</p>}
            </form>
          )}
        </Spotlight>
      </div>
      <Spotlight className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h2>อ่านตารางนี้อย่างไร</h2></div>
        <p className="note" style={{ margin: 0 }}>
          &ldquo;ห่างจากเป้า&rdquo; คือสัดส่วนตอนนี้ลบเป้าที่คุณตั้งไว้ (หน่วยเป็นจุด %) · &ldquo;สัดส่วนลดลง&rdquo; คือถ้าคุณไม่ซื้อเพิ่ม ส่วนแบ่งของคุณใน supply ที่หมุนเวียนจะเล็กลงเท่าไรจาก unlock ที่ตั้งเวลาไว้แล้ว ·
          ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน
        </p>
      </Spotlight>
    </>
  );
}
