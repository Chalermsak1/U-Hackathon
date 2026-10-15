"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RiskCardView } from "@/components/Cards";
import { RECIPIENT_COLOR, RECIPIENT_LABEL, Spotlight, StackedBars } from "@/components/fx";
import { compact, usd } from "@/lib/format";
import type { RecipientClass, RiskCard } from "@/lib/types";
import { classifyRecipient } from "@/lib/recipient";

interface TokenData {
  tracked: boolean;
  symbol?: string;
  token?: { symbol: string; name: string; marketCap: number; circulating: number; maxSupply: number; floatPct: number; priceUsd: number; volume24hUsd: number | null };
  card?: RiskCard | null;
  forecast?: { months: { month: string; total: number; byRecipient: Partial<Record<RecipientClass, number>> }[]; totalNew: number; dilutionPct: number; pctOfMcapPerMonth: number | null } | null;
  allocations?: { allocationName: string; standardAllocationName: string; allocationAmount: number; allocationLockedAmount: number; trackedAllocationPercentage: number }[];
  fundraising?: { fundingRound: string; fundingDate: string; amountRaised: number | null; valuation: number | null }[];
  totalRaised?: number | null;
  source?: string;
}

interface ScreenerRow {
  symbol: string;
  marketCap: number;
  fdv: number;
  floatPct: number | null;
  totalRaised: number | null;
  pctInvestorsUnlocked: number | null;
  latestRound: string | null;
  leadInvestors: string | null;
}

// Token page ("supply mode"): risk now, supply over the next 6 months, who holds what, who paid what.
export default function TokenPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const router = useRouter();
  const [data, setData] = useState<TokenData | null>(null);
  const [screen, setScreen] = useState<ScreenerRow | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setFailed(false);
    // A failed request is not the same as "no unlock data": keep them apart so the
    // page never tells someone a token is safe-looking just because the server hiccupped.
    fetch(`/api/token/${symbol}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(() => setFailed(true));
    fetch("/api/screener")
      .then((r) => r.json())
      .then((b: { rows: ScreenerRow[] }) => setScreen(b.rows.find((r) => r.symbol === String(symbol).toUpperCase()) ?? null))
      .catch(() => undefined);
  }, [symbol, attempt]);

  if (failed) {
    return (
      <p className="empty">
        โหลดข้อมูล {String(symbol).toUpperCase()} ไม่สำเร็จ{" "}
        <button className="btn btn-sm" onClick={() => setAttempt((n) => n + 1)}>
          ลองใหม่
        </button>
      </p>
    );
  }
  if (!data) return <p className="note">กำลังโหลด…</p>;
  const sym = String(symbol).toUpperCase();

  if (!data.tracked) {
    return (
      <>
        <div className="page-title">
          <h1>{sym}</h1>
          <p>ยังไม่มีตาราง unlock เต็มใน demo นี้ (ต้องใช้ Tokenomist API key แล้วรัน snapshot)</p>
        </div>
        {screen ? (
          <div className="kpis">
            <div className="kpi"><span>Market cap</span><b>{usd(screen.marketCap)}</b></div>
            <div className="kpi"><span>FDV</span><b>{usd(screen.fdv)}</b></div>
            <div className="kpi"><span>Float</span><b>{screen.floatPct?.toFixed(0)}%</b><small>ส่วนที่เหลือยังรอเข้าตลาด</small></div>
            <div className="kpi"><span>นักลงทุนปลดล็อกแล้ว</span><b>{screen.pctInvestorsUnlocked ?? "–"}%</b><small>{screen.latestRound ?? ""}</small></div>
          </div>
        ) : (
          <p className="empty">ไม่พบเหรียญนี้ใน screener</p>
        )}
        <button className="btn btn-primary" onClick={() => router.push(`/terminal/agent?q=${encodeURIComponent(`${sym} มี unlock ไหม`)}`)}>
          ถาม U-Guard เรื่อง {sym}
        </button>
      </>
    );
  }

  const t = data.token!;
  const allocations = data.allocations ?? [];
  const totalAlloc = allocations.reduce((s, a) => s + a.allocationAmount, 0) || 1;

  return (
    <>
      <div className="page-title">
        <h1>
          {t.symbol} <span className="note" style={{ fontSize: 16 }}>{t.name}</span>
        </h1>
        <p>ราคา ~${t.priceUsd.toFixed(t.priceUsd < 1 ? 4 : 2)} · ข้อมูล {data.source === "live" ? "สดจาก Tokenomist" : "ตัวอย่าง / Tokenomist 15 ต.ค."}</p>
        <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => router.push(`/terminal/agent?q=${encodeURIComponent(`ซื้อ ${t.symbol} 5,000 บาท`)}`)}>
          ถาม U-Guard ก่อนซื้อ
        </button>
      </div>

      <div className="kpis">
        <div className="kpi"><span>Market cap</span><b>{usd(t.marketCap)}</b></div>
        <div className="kpi"><span>FDV</span><b>{usd(t.priceUsd * t.maxSupply)}</b></div>
        <div className="kpi"><span>Float</span><b>{t.floatPct.toFixed(1)}%</b><small>{compact(t.circulating)} / {compact(t.maxSupply)}</small></div>
        <div className="kpi">
          <span>เหรียญใหม่ 6 เดือน</span>
          <b>{compact(data.forecast?.totalNew ?? 0)}</b>
          <small>สัดส่วนผู้ถือลดลง {data.forecast?.dilutionPct.toFixed(1) ?? 0}%</small>
        </div>
        <div className="kpi">
          <span>แรงกด supply ต่อเดือน</span>
          <b>{data.forecast?.pctOfMcapPerMonth === null || data.forecast?.pctOfMcapPerMonth === undefined ? "–" : `${data.forecast.pctOfMcapPerMonth.toFixed(2)}%`}</b>
          <small>ของ market cap</small>
        </div>
      </div>

      <div className="grid-2">
        <div>{data.card && <RiskCardView card={data.card} />}</div>
        <Spotlight className="panel">
          <div className="panel-head">
            <h2>Supply ที่จะเข้าตลาด 6 เดือน</h2>
            <span className="total">ตาม vesting schedule</span>
          </div>
          {data.forecast && data.forecast.totalNew > 0 ? (
            <>
              <StackedBars months={data.forecast.months} />
              <div className="legend" style={{ marginTop: 6 }}>
                {(Object.keys(RECIPIENT_LABEL) as RecipientClass[])
                  .filter((r) => data.forecast!.months.some((m) => m.byRecipient[r]))
                  .map((r) => (
                    <span key={r}>
                      <i style={{ background: RECIPIENT_COLOR[r] }} />
                      {RECIPIENT_LABEL[r]}
                    </span>
                  ))}
              </div>
            </>
          ) : (
            <p className="empty">ไม่มี unlock ที่ตั้งเวลาไว้ใน 6 เดือนข้างหน้าใน demo data</p>
          )}
        </Spotlight>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <Spotlight className="panel">
          <div className="panel-head"><h2>ใครถือ supply (allocation)</h2></div>
          <div className="split" style={{ height: 10 }} aria-hidden="true">
            {allocations.map((a) => (
              <i key={a.allocationName} style={{ width: `${(a.allocationAmount / totalAlloc) * 100}%`, background: RECIPIENT_COLOR[classifyRecipient(a.allocationName, a.standardAllocationName)] }} />
            ))}
          </div>
          <div className="table-scroll">
            <table className="t-table" style={{ minWidth: 0 }}>
              <thead>
                <tr><th>กลุ่ม</th><th className="num">สัดส่วน</th><th className="num">ยังล็อก</th></tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={a.allocationName}>
                    <td>
                      <span className="dot" style={{ display: "inline-block", marginRight: 6, background: RECIPIENT_COLOR[classifyRecipient(a.allocationName, a.standardAllocationName)] }} />
                      {a.allocationName}
                    </td>
                    <td className="num">{a.trackedAllocationPercentage.toFixed(1)}%</td>
                    <td className="num">{compact(a.allocationLockedAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Spotlight>
        <Spotlight className="panel">
          <div className="panel-head">
            <h2>รอบระดมทุน</h2>
            <span className="total">รวม {data.totalRaised ? usd(data.totalRaised) : "–"}</span>
          </div>
          <div className="table-scroll">
            <table className="t-table" style={{ minWidth: 0 }}>
              <thead>
                <tr><th>รอบ</th><th>วันที่</th><th className="num">ระดม</th><th className="num">Valuation</th></tr>
              </thead>
              <tbody>
                {(data.fundraising ?? []).map((f) => (
                  <tr key={f.fundingRound + f.fundingDate}>
                    <td>{f.fundingRound}</td>
                    <td>{new Date(f.fundingDate).toLocaleDateString("th-TH", { year: "numeric", month: "short" })}</td>
                    <td className="num">{f.amountRaised ? usd(f.amountRaised) : "–"}</td>
                    <td className="num">{f.valuation ? usd(f.valuation) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note" style={{ marginTop: 8 }}>
            <Link href="/terminal/tokens">← กลับไป screener</Link>
          </p>
        </Spotlight>
      </div>
    </>
  );
}
