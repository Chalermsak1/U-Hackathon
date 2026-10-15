"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CountUp, Spotlight } from "@/components/fx";
import { LEVEL_LABEL, thb, unlockWhen } from "@/lib/format";
import { openReport, type ReportResult } from "@/lib/report";
import type { Holding, RiskCard } from "@/lib/types";

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
  if (!data) return <p className="note">Loading your portfolio…</p>;

  const cards = data.rows.flatMap((r) => (r.card ? [r.card] : []));
  const report = () => {
    const result: ReportResult = {
      reply: `Portfolio value ${thb(data.totalThb)} · value facing a risky unlock in 30 days ${thb(data.atRiskThb)}`,
      cards,
      proposals: [],
      trace: [],
    };
    openReport("Portfolio risk summary", result);
  };
  const concentrated = data.topHolding && data.topHolding.weightPct > 40;

  return (
    <>
      <div className="page-title">
        <h1>My portfolio</h1>
        <p>U-topia wallet (demo) · AVAX reads the real Avalanche balance when WALLET_ADDRESS is set</p>
        <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={report}>
          Portfolio summary as PDF
        </button>
      </div>
      <div className="kpis">
        <div className="kpi"><span>Total value</span><b><CountUp value={data.totalThb} format={thb} /></b></div>
        <div className="kpi">
          <span>Facing a risky unlock (30 days)</span>
          <b style={{ color: data.atRiskThb ? "var(--coral)" : undefined }}><CountUp value={data.atRiskThb} format={thb} /></b>
          <small>{data.totalThb ? ((data.atRiskThb / data.totalThb) * 100).toFixed(0) : 0}% of portfolio</small>
        </div>
        <div className="kpi">
          <span>Largest holding</span>
          <b>{data.topHolding?.symbol}</b>
          <small style={{ color: concentrated ? "var(--amber)" : undefined }}>
            {data.topHolding?.weightPct.toFixed(0)}% of portfolio{concentrated ? " · highly concentrated" : ""}
          </small>
        </div>
      </div>
      <div className="table-wrap">
        <table className="t-table">
          <thead>
            <tr>
              <th>Token</th>
              <th className="num">Amount</th>
              <th className="num">Value</th>
              <th className="num">Weight</th>
              <th>Next unlock</th>
              <th>Risk</th>
              <th className="num">Diluted over 6 months</th>
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
                <td>{r.card ? unlockWhen(r.card) || "–" : "–"}</td>
                <td>
                  <span className={`pill lv-${r.card?.level ?? "none"}`}>
                    {r.card ? `${LEVEL_LABEL[r.card.level]}${r.card.level !== "none" ? ` ${r.card.score}` : ""}` : "No unlock"}
                  </span>
                </td>
                <td className="num">{r.dilutionPct ? `${r.dilutionPct.toFixed(1)}%` : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Spotlight className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head"><h2>How to read this table</h2></div>
        <p className="note" style={{ margin: 0 }}>
          &ldquo;Diluted&rdquo; is how much your share of the circulating supply shrinks from already-scheduled unlocks if you don&apos;t buy more ·
          Decision support, not investment advice
        </p>
      </Spotlight>
    </>
  );
}
