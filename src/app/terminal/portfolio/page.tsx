"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DriftCardView } from "@/components/Cards";
import { CountUp, Spotlight } from "@/components/fx";
import { asOfLabel } from "@/lib/freshness";
import { LEVEL_LABEL, thb, unlockWhen } from "@/lib/format";
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
      if (!res.ok) throw new Error(body.error ?? "Could not save");
      loadTargets(body);
      setMsg("Targets saved");
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const sum = Object.values(targets).reduce((s, v) => s + (Number(v) || 0), 0);
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
        <p>U-topia wallet (demo) · AVAX reads the real Avalanche balance when WALLET_ADDRESS is set{drift?.pricesAsOf ? ` · prices ${asOfLabel(drift.pricesAsOf)}` : ""}</p>
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
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div>{drift && <DriftCardView drift={drift} />}</div>
        <Spotlight className="panel">
          <div className="panel-head">
            <h2>Your target mix</h2>
            <span className="total">total {sum}%</span>
          </div>
          <p className="note" style={{ margin: 0 }}>Set how much of each token you want to hold. U-Guard tells you when the portfolio drifts outside the band (it never says buy or sell).</p>
          <form onSubmit={saveTargets}>
            <div className="drift-editor">
              {Object.keys(targets).map((s) => (
                <label key={s}>
                  {s} (%)
                  <input inputMode="decimal" value={targets[s]} onChange={(e) => setTargets((t) => ({ ...t, [s]: e.target.value }))} />
                </label>
              ))}
              <label>
                Band (± pts)
                <input inputMode="decimal" value={band} onChange={(e) => setBand(e.target.value)} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
              <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>{saving ? "Saving…" : "Save targets"}</button>
              {Math.abs(sum - 100) > 1 && sum !== 0 && <span className="error">Must add up to 100%</span>}
              {msg && <span className="note">{msg}</span>}
            </div>
          </form>
        </Spotlight>
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
