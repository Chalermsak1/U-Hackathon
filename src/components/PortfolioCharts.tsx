"use client";

// Portfolio charts: value over the last 30 days next to the dated events of the next 30 days,
// where the money sits (by token, coloured by unlock risk), and value by risk level. Every
// colour also has a text label, so nothing is said by colour alone.

import { useEffect, useMemo, useRef, useState } from "react";
import type { PortfolioHistory } from "@/lib/history";
import { compact, LEVEL_LABEL, shortDate, signedPct, thb } from "@/lib/format";
import type { RiskLevel } from "@/lib/types";
import s from "./PortfolioCharts.module.css";

export interface ChartRow {
  symbol: string;
  valueThb: number;
  weightPct: number;
  card: { level: RiskLevel } | null;
}

const LEVEL_COLOR: Record<RiskLevel | "na", string> = {
  high: "#fb7151",
  medium: "#fbbf24",
  low: "#2dd4bf",
  none: "#64748b",
  na: "#64748b",
};
const levelOf = (r: ChartRow): RiskLevel => r.card?.level ?? "none";
const levelName = (l: RiskLevel) => (l === "none" ? "No unlock" : `${LEVEL_LABEL[l]} risk`);

// ─── Value chart geometry (viewBox units) ───
const W = 720;
const H = 260;
const PAD = { l: 58, r: 14, t: 34, b: 30 };
const DAY = 86_400_000;

function ValueChart({ h }: { h: PortfolioHistory }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const pts = h.points;
  const values = pts.map((p) => p.valueThb);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(1, hi - lo);
  const yMin = lo - span * 0.12;
  const yMax = hi + span * 0.12;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  // x runs from 30 days ago (0) to today (30) to 30 days ahead (60).
  const x = (dayIdx: number) => PAD.l + (dayIdx / 60) * plotW;
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const todayMs = Date.parse(`${pts[pts.length - 1].date}T00:00:00Z`);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.valueThb).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${PAD.t + plotH} L${x(0).toFixed(1)},${PAD.t + plotH} Z`;
  const up = (h.changePct ?? 0) >= 0;
  const stroke = up ? "#2dd4bf" : "#fb7151";

  // One marker per date; several events on a day share it.
  const markers = useMemo(() => {
    const byDate = new Map<string, PortfolioHistory["events"]>();
    for (const e of h.events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
    return [...byDate.entries()]
      .map(([date, evs]) => ({ date, evs, idx: 30 + Math.round((Date.parse(`${date}T00:00:00Z`) - todayMs) / DAY) }))
      .filter((m) => m.idx >= 30 && m.idx <= 60);
  }, [h.events, todayMs]);

  const color = (e: PortfolioHistory["events"][number]) =>
    e.kind === "macro" ? "#a78bfa" : e.importance === "high" ? "#fb7151" : e.importance === "medium" ? "#fbbf24" : "#94a3b8";

  const onMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const vx = ((ev.clientX - box.left) / box.width) * W;
    const idx = Math.round(((vx - PAD.l) / plotW) * 60);
    setHover(idx >= 0 && idx <= 30 ? idx : null);
  };

  const ticks = [yMax - (yMax - yMin) * 0.1, (yMin + yMax) / 2, yMin + (yMax - yMin) * 0.1];
  const hp = hover !== null ? pts[hover] : null;

  return (
    <svg
      ref={ref}
      className={s.svg}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Portfolio value over the last 30 days: from ${thb(values[0])} to ${thb(values[values.length - 1])}${
        h.changePct !== null ? ` (${signedPct(h.changePct)})` : ""
      }. Coming up: ${markers.map((m) => `${shortDate(m.date)} ${m.evs.map((e) => e.title.replace(/:.*$/, "")).join(", ")}`).join("; ") || "no scheduled events"}.`}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <defs>
        <linearGradient id="pc-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.32" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* the next 30 days */}
      <rect x={x(30)} y={PAD.t} width={x(60) - x(30)} height={plotH} fill="rgba(232,241,245,0.035)" />
      <text x={x(45)} y={PAD.t - 12} textAnchor="middle" className={s.axisLabel}>
        Next 30 days
      </text>
      <text x={x(15)} y={PAD.t - 12} textAnchor="middle" className={s.axisLabel}>
        Last 30 days
      </text>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="rgba(232,241,245,0.07)" />
          <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className={s.axisLabel}>
            ฿{compact(t, 1)}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#pc-area)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
      {/* event markers */}
      {markers.map((m) => (
        <g key={m.date}>
          <line x1={x(m.idx)} x2={x(m.idx)} y1={PAD.t + 4} y2={PAD.t + plotH} stroke={color(m.evs[0])} strokeWidth="2" strokeDasharray="4 4" />
          <circle cx={x(m.idx)} cy={PAD.t + plotH - 6} r="5" fill={color(m.evs[0])}>
            <title>{`${shortDate(m.date)}: ${m.evs.map((e) => e.title).join(" · ")}`}</title>
          </circle>
        </g>
      ))}
      {/* today */}
      <line x1={x(30)} x2={x(30)} y1={PAD.t} y2={PAD.t + plotH} stroke="rgba(232,241,245,0.35)" />
      <circle cx={x(30)} cy={y(values[values.length - 1])} r="4.5" fill={stroke} />
      {[0, 30, 60].map((i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === 60 ? "end" : "middle"} className={s.axisLabel}>
          {i === 30 ? "Today" : shortDate(new Date(todayMs + (i - 30) * DAY).toISOString())}
        </text>
      ))}
      {hp && hover !== null && (
        <g pointerEvents="none">
          <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + plotH} stroke="rgba(232,241,245,0.4)" />
          <circle cx={x(hover)} cy={y(hp.valueThb)} r="4" fill="#e8f1f5" />
          <g transform={`translate(${Math.min(x(hover) + 8, W - PAD.r - 132)},${PAD.t + 6})`}>
            <rect width="128" height="40" rx="6" fill="#142036" stroke="rgba(232,241,245,0.18)" />
            <text x="8" y="16" className={s.tipDate}>
              {shortDate(hp.date)}
            </text>
            <text x="8" y="32" className={s.tipValue}>
              {thb(hp.valueThb)}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}

function Donut({ rows, totalThb }: { rows: ChartRow[]; totalThb: number }) {
  const R = 64;
  const C = 2 * Math.PI * R;
  const held = rows.filter((r) => r.valueThb > 0).sort((a, b) => b.valueThb - a.valueThb);
  let offset = 0;
  return (
    <div className={s.donutWrap}>
      <svg viewBox="0 0 180 180" className={s.donut} role="img" aria-label={held.map((r) => `${r.symbol} ${r.weightPct.toFixed(1)}%, ${levelName(levelOf(r))}`).join("; ")}>
        <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(232,241,245,0.06)" strokeWidth="22" />
        {held.map((r) => {
          const len = (r.weightPct / 100) * C;
          const seg = (
            <circle
              key={r.symbol}
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke={LEVEL_COLOR[levelOf(r)]}
              strokeWidth="22"
              strokeDasharray={`${Math.max(0, len - 2.5)} ${C}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 90 90)"
            >
              <title>{`${r.symbol} · ${r.weightPct.toFixed(1)}% · ${levelName(levelOf(r))}`}</title>
            </circle>
          );
          offset += len;
          return seg;
        })}
        <text x="90" y="86" textAnchor="middle" className={s.donutValue}>
          ฿{compact(totalThb, 1)}
        </text>
        <text x="90" y="106" textAnchor="middle" className={s.axisLabel}>
          total
        </text>
      </svg>
      <ul className={s.legend}>
        {held.map((r) => (
          <li key={r.symbol}>
            <i style={{ background: LEVEL_COLOR[levelOf(r)] }} />
            <b>{r.symbol}</b>
            <span>{r.weightPct.toFixed(1)}%</span>
            <em>{levelName(levelOf(r))}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RiskBar({ rows, totalThb }: { rows: ChartRow[]; totalThb: number }) {
  const order: RiskLevel[] = ["high", "medium", "low", "none"];
  const sums = order.map((l) => ({ l, v: rows.filter((r) => levelOf(r) === l).reduce((a, r) => a + r.valueThb, 0) })).filter((x) => x.v > 0);
  return (
    <div>
      <div className={s.riskBar} role="img" aria-label={sums.map((x) => `${levelName(x.l)} ${thb(x.v)}`).join(", ")}>
        {sums.map((x) => (
          <i key={x.l} style={{ flexGrow: x.v, background: LEVEL_COLOR[x.l] }} title={`${levelName(x.l)} · ${thb(x.v)}`} />
        ))}
      </div>
      <ul className={s.riskLegend}>
        {sums.map((x) => (
          <li key={x.l}>
            <i style={{ background: LEVEL_COLOR[x.l] }} />
            {levelName(x.l)} <b>{thb(x.v)}</b> <span>{totalThb ? Math.round((x.v / totalThb) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PortfolioCharts({ rows, totalThb }: { rows: ChartRow[]; totalThb: number }) {
  const [h, setH] = useState<PortfolioHistory | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch("/api/portfolio/history")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(setH)
      .catch(() => setFailed(true));
  }, []);

  return (
    <div className={s.grid}>
      <section className={`panel ${s.valuePanel}`} aria-label="Portfolio value and what is coming">
        <div className="panel-head">
          <h2>Portfolio value · last 30 days and the next 30</h2>
          {h?.changePct != null && (
            <span className={s.change} style={{ color: h.changePct >= 0 ? "var(--teal-2)" : "var(--coral)" }}>
              {signedPct(h.changePct)} in 30 days
            </span>
          )}
        </div>
        {h && h.points.length > 1 ? (
          <>
            <ValueChart h={h} />
            {h.events.length > 0 && (
              <ol className={s.events}>
                {h.events.slice(0, 5).map((e) => (
                  <li key={`${e.date}-${e.title}`}>
                    <span className={s.eventDate}>{shortDate(e.date)}</span>
                    <span
                      className={s.eventTag}
                      style={{ color: e.kind === "macro" ? "var(--violet)" : e.importance === "high" ? "var(--coral)" : e.importance === "medium" ? "var(--amber)" : "var(--slate)" }}
                    >
                      {e.kind === "macro" ? "Macro" : `${e.importance[0].toUpperCase()}${e.importance.slice(1)} impact`}
                    </span>
                    <span>{e.title}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="note" style={{ margin: "8px 0 0" }}>
              Today&apos;s holdings at each day&apos;s price (CoinGecko daily prices
              {h.flat.length ? `; ${h.flat.join(", ")} held at today's price` : ""}) · stablecoins at $1 · events from Tokenomist and the Fed calendar
            </p>
          </>
        ) : (
          <p className="note">{failed ? "Price history is unavailable right now. The rest of the page still works." : "Loading 30 days of prices…"}</p>
        )}
      </section>
      <section className={`panel ${s.sidePanel}`} aria-label="Where your money sits">
        <div className="panel-head">
          <h2>Where your money sits</h2>
          <span className="total">colour = unlock risk</span>
        </div>
        <Donut rows={rows} totalThb={totalThb} />
        <div className="panel-head" style={{ marginTop: 14, marginBottom: 8 }}>
          <h2>Value by unlock risk</h2>
        </div>
        <RiskBar rows={rows} totalThb={totalThb} />
      </section>
    </div>
  );
}
