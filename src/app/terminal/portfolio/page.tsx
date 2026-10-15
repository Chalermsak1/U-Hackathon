"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CountUp, Spotlight } from "@/components/fx";
import { LEVEL_TH, thb, untilText } from "@/lib/format";
import { openReport } from "@/lib/report";
import type { AgentResult, Holding, RiskCard } from "@/lib/types";

interface Row extends Holding {
  weightPct: number;
  card: RiskCard | null;
  dilutionPct: number;
}

// Portfolio: weight, unlock risk and 6-month dilution per holding, plus concentration.
export default function PortfolioPage() {
  const [data, setData] = useState<{ rows: Row[]; totalThb: number; atRiskThb: number; topHolding: { symbol: string; weightPct: number } | null } | null>(null);

  useEffect(() => {
    fetch("/api/portfolio/risk").then((r) => r.json()).then(setData).catch(() => undefined);
  }, []);
  if (!data) return <p className="note">กำลังโหลดพอร์ต…</p>;

  const cards = data.rows.flatMap((r) => (r.card ? [r.card] : []));
  const report = () => {
    const result: AgentResult = {
      reply: `พอร์ตมูลค่า ${thb(data.totalThb)} · มูลค่าที่มี unlock เสี่ยงใน 30 วัน ${thb(data.atRiskThb)}`,
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
