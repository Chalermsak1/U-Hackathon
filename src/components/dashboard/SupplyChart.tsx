"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { compact, pct } from "@/lib/format";
import type { SupplyForecast } from "@/lib/forecast";
import { SourceBadge } from "../chat/bits";

const H = 240;
const PAD = { top: 16, right: 8, bottom: 28, left: 48 };
const GAP = 2; // surface gap between stacked segments

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * exp;
}

/** Monthly new supply, insiders (team + investors) vs everyone else: stacked columns. */
export function SupplyChart({ forecasts, holdings }: { forecasts: SupplyForecast[]; holdings: Record<string, number> }) {
  const [symbol, setSymbol] = useState(forecasts[0]?.symbol ?? "");
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the container's real width so text stays 11px on a phone instead of scaling down.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const f = forecasts.find((x) => x.symbol === symbol) ?? forecasts[0];
  const [amount, setAmount] = useState<string>(String(holdings[f?.symbol ?? ""] ?? 1000));

  const geo = useMemo(() => {
    if (!f) return null;
    const max = niceMax(Math.max(...f.months.map((m) => m.insiders + m.other), 1));
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const band = innerW / f.months.length;
    const barW = Math.min(24, band * 0.5);
    const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
    const ticks = [0, max / 2, max];
    return { max, innerW, innerH, band, barW, y, ticks, labelDigits: band >= 56 ? 2 : 1 };
  }, [f, W]);

  if (!f || !geo) return null;
  const held = Number(amount.replace(/,/g, "")) || 0;
  const needed = f.circulating > 0 ? (held * f.totalNew) / f.circulating : 0;
  const lastMonth = f.months[f.months.length - 1]?.label;

  return (
    <div>
      <div className="spread" style={{ marginBottom: 10 }}>
        <div className="tabs-inline" role="tablist" aria-label="Token">
          {forecasts.map((x) => (
            <button
              key={x.symbol}
              type="button"
              role="tab"
              aria-selected={x.symbol === f.symbol}
              className="chip"
              style={x.symbol === f.symbol ? { borderColor: "var(--teal)", background: "var(--surface-2)" } : undefined}
              onClick={() => {
                setSymbol(x.symbol);
                setAmount(String(holdings[x.symbol] ?? 1000));
                setHover(null);
              }}
            >
              {x.symbol}
            </button>
          ))}
        </div>
        <SourceBadge source={f.source} asOf={f.asOf} />
      </div>

      <p style={{ margin: "0 0 10px", fontSize: 14 }} className="muted">
        <b style={{ color: "var(--text)" }}>
          +{compact(f.totalNew, 2)} {f.symbol}
        </b>{" "}
        scheduled over the next {f.months.length} months: {pct(f.pctOfCirculating)} of today&apos;s circulating supply.
        {f.months.some((m) => m.estimate) ? " Continuous releases are estimates for the period the data covers." : ""}
      </p>

      <div className="legend" style={{ marginBottom: 6 }}>
        <span>
          <i style={{ background: "var(--series-1)" }} /> Team &amp; investors
        </span>
        <span>
          <i style={{ background: "var(--series-2)" }} /> Community, ecosystem &amp; reserve
        </span>
      </div>

      <div className="chart" ref={wrapRef} data-hover={hover !== null ? "" : undefined} onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${f.symbol} new supply per month`}>
          {geo.ticks.map((t) => (
            <g key={t}>
              <line className="gridline" x1={PAD.left} x2={W - PAD.right} y1={geo.y(t)} y2={geo.y(t)} />
              <text className="axis" x={PAD.left - 8} y={geo.y(t) + 4} textAnchor="end">
                {compact(t, 0)}
              </text>
            </g>
          ))}
          {f.months.map((m, i) => {
            const cx = PAD.left + geo.band * i + geo.band / 2;
            const x = cx - geo.barW / 2;
            const yBase = geo.y(0);
            const hIns = yBase - geo.y(m.insiders);
            const hOther = yBase - geo.y(m.other);
            const topIsOther = m.other > 0;
            const segOther = Math.max(0, hOther - (m.insiders > 0 && m.other > 0 ? GAP : 0));
            const total = m.insiders + m.other;
            return (
              <g key={m.month} className="mark" data-active={hover === i ? "" : undefined}>
                {m.insiders > 0 ? (
                  <path
                    d={roundedTop(x, yBase - hIns, geo.barW, hIns, topIsOther ? 0 : 4)}
                    fill="var(--series-1)"
                  />
                ) : null}
                {m.other > 0 ? (
                  <path d={roundedTop(x, yBase - hIns - hOther, geo.barW, segOther, 4)} fill="var(--series-2)" />
                ) : null}
                <text className="axis" x={cx} y={H - 8} textAnchor="middle">
                  {m.label}
                  {m.estimate ? "*" : ""}
                </text>
                {total > 0 && hover === null ? (
                  <text className="value-label" x={cx} y={geo.y(total) - 6} textAnchor="middle">
                    {compact(total, geo.labelDigits)}
                  </text>
                ) : null}
                <rect
                  className="hit"
                  x={PAD.left + geo.band * i}
                  y={PAD.top}
                  width={geo.band}
                  height={geo.innerH}
                  tabIndex={0}
                  aria-label={`${m.label}: ${compact(total, 2)} ${f.symbol}`}
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {hover !== null ? (
          <div
            className="tooltip"
            style={{
              left: `${((PAD.left + geo.band * hover + geo.band / 2) / W) * 100}%`,
              top: `${(geo.y(f.months[hover].insiders + f.months[hover].other) / H) * 100}%`,
            }}
          >
            <strong>
              {compact(f.months[hover].insiders + f.months[hover].other, 2)} {f.symbol}
            </strong>
            <div className="dim">
              {f.months[hover].label}
              {f.months[hover].estimate ? " (estimate)" : ""}
            </div>
            <div>
              <span className="key" style={{ background: "var(--series-1)" }} />
              {compact(f.months[hover].insiders, 2)} team &amp; investors
            </div>
            <div>
              <span className="key" style={{ background: "var(--series-2)" }} />
              {compact(f.months[hover].other, 2)} other
            </div>
          </div>
        ) : null}
      </div>

      <details className="table-view">
        <summary>Show as table</summary>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Month</th>
                <th className="r">Team &amp; investors</th>
                <th className="r">Other</th>
                <th className="r">% of circulating</th>
              </tr>
            </thead>
            <tbody>
              {f.months.map((m) => (
                <tr key={m.month}>
                  <td>
                    {m.month}
                    {m.estimate ? " (est.)" : ""}
                  </td>
                  <td className="r">{compact(m.insiders, 2)}</td>
                  <td className="r">{compact(m.other, 2)}</td>
                  <td className="r">{f.circulating > 0 ? pct(((m.insiders + m.other) / f.circulating) * 100) : "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="calc">
        <label htmlFor="dilution-amount" style={{ fontSize: 14, fontWeight: 600 }}>
          Dilution calculator
        </label>
        <div className="row">
          <input
            id="dilution-amount"
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            style={{ maxWidth: 200 }}
            aria-describedby="dilution-result"
          />
          <span className="muted">{f.symbol} held</span>
        </div>
        <p id="dilution-result" className="result" style={{ margin: 0 }}>
          If nothing else changes, your share of circulating {f.symbol} shrinks <b>{pct(f.dilutionPct)}</b> by {lastMonth}. Keeping the
          same share would take about{" "}
          <b>
            {compact(needed, 2)} more {f.symbol}
          </b>
          .
        </p>
      </div>
    </div>
  );
}

/** Column path: square at the baseline, rounded data-end (r) on top. */
function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}
