"use client";

// Token price chart: live candles (Hyperliquid, CoinGecko fallback) with the scheduled unlock
// dates drawn on it, so the price and the supply calendar are read together.

import { useEffect, useMemo, useRef, useState } from "react";
import { shortDate } from "@/lib/format";

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}
type Range = "7d" | "30d" | "90d";
export interface ChartMarker {
  date: string; // ISO
  label: string;
}

const W = 720;
const H = 240;
const PAD = { l: 8, r: 64, t: 14, b: 26 };

function fmt(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  return `$${p.toPrecision(4)}`;
}

export function PriceChart({ symbol, markers = [] }: { symbol: string; markers?: ChartMarker[] }) {
  const [range, setRange] = useState<Range>("30d");
  const [data, setData] = useState<{ candles: Candle[]; source: string } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    fetch(`/api/token/${symbol}/candles?range=${range}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => alive && setData(b ?? { candles: [], source: "none" }))
      .catch(() => alive && setData({ candles: [], source: "none" }));
    return () => {
      alive = false;
    };
  }, [symbol, range]);

  const geo = useMemo(() => {
    const c = data?.candles ?? [];
    if (c.length < 2) return null;
    const t0 = c[0].t;
    const t1 = Math.max(c[c.length - 1].t, ...markers.map((m) => Date.parse(m.date)).filter((t) => t > c[c.length - 1].t && t - c[c.length - 1].t < 0.25 * (c[c.length - 1].t - t0)));
    const lo = Math.min(...c.map((k) => k.l));
    const hi = Math.max(...c.map((k) => k.h));
    const pad = (hi - lo) * 0.08 || hi * 0.02;
    const y = (p: number) => PAD.t + (1 - (p - (lo - pad)) / (hi + pad - (lo - pad))) * (H - PAD.t - PAD.b);
    const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r);
    const line = c.map((k, i) => `${i ? "L" : "M"}${x(k.t).toFixed(1)},${y(k.c).toFixed(1)}`).join("");
    const area = `${line}L${x(c[c.length - 1].t).toFixed(1)},${H - PAD.b}L${x(c[0].t).toFixed(1)},${H - PAD.b}Z`;
    const first = c[0].c;
    const last = c[c.length - 1].c;
    const ticks = [lo, (lo + hi) / 2, hi];
    const marks = markers
      .map((m) => ({ ...m, t: Date.parse(m.date) }))
      .filter((m) => m.t >= t0 && m.t <= t1)
      .map((m) => ({ ...m, x: x(m.t) }));
    return { c, x, y, line, area, first, last, ticks, marks, up: last >= first };
  }, [data, markers]);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!geo || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 0; i < geo.c.length; i++) if (Math.abs(geo.x(geo.c[i].t) - px) < Math.abs(geo.x(geo.c[best].t) - px)) best = i;
    setHover(best);
  };

  const h = geo && hover !== null ? geo.c[hover] : null;
  const change = geo ? ((geo.last - geo.first) / geo.first) * 100 : 0;
  const color = geo?.up ? "var(--teal)" : "var(--coral)";

  return (
    <section className="panel price-chart">
      <div className="panel-head">
        <h2>
          {symbol} price{" "}
          {geo && (
            <span className="pc-now">
              {fmt(h ? h.c : geo.last)}{" "}
              <em style={{ color: h ? "var(--muted)" : color }}>{h ? new Date(h.t).toLocaleString("en-US", { month: "short", day: "numeric", hour: range === "90d" ? undefined : "2-digit", minute: range === "90d" ? undefined : "2-digit" }) : `${change >= 0 ? "+" : ""}${change.toFixed(1)}% ${range}`}</em>
            </span>
          )}
        </h2>
        <div className="seg" role="group" aria-label="Chart range">
          {(["7d", "30d", "90d"] as Range[]).map((r) => (
            <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {!data && <div className="pc-skeleton" />}
      {data && !geo && <p className="empty">No price history for {symbol} right now.</p>}
      {geo && (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="pc-svg"
          role="img"
          aria-label={`${symbol} price over ${range}: from ${fmt(geo.first)} to ${fmt(geo.last)}${geo.marks.length ? `, with ${geo.marks.length} unlock date(s) marked` : ""}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`pc-fill-${symbol}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={geo.up ? "#2dd4bf" : "#fb7151"} stopOpacity="0.28" />
              <stop offset="100%" stopColor={geo.up ? "#2dd4bf" : "#fb7151"} stopOpacity="0" />
            </linearGradient>
          </defs>
          {geo.ticks.map((p) => (
            <g key={p}>
              <line x1={PAD.l} x2={W - PAD.r} y1={geo.y(p)} y2={geo.y(p)} className="pc-grid" />
              <text x={W - PAD.r + 6} y={geo.y(p) + 4} className="pc-axis">
                {fmt(p)}
              </text>
            </g>
          ))}
          <path d={geo.area} fill={`url(#pc-fill-${symbol})`} />
          <path d={geo.line} fill="none" stroke={geo.up ? "#2dd4bf" : "#fb7151"} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          {geo.marks.map((m) => (
            <g key={m.date + m.label} className="pc-mark">
              <line x1={m.x} x2={m.x} y1={PAD.t} y2={H - PAD.b} />
              <text x={Math.min(m.x + 4, W - PAD.r - 90)} y={PAD.t + 10}>
                {m.label}
              </text>
            </g>
          ))}
          {h && (
            <g>
              <line x1={geo.x(h.t)} x2={geo.x(h.t)} y1={PAD.t} y2={H - PAD.b} className="pc-cross" />
              <circle cx={geo.x(h.t)} cy={geo.y(h.c)} r="3.5" fill={geo.up ? "#2dd4bf" : "#fb7151"} />
            </g>
          )}
          <text x={PAD.l} y={H - 8} className="pc-axis">
            {shortDate(new Date(geo.c[0].t).toISOString())}
          </text>
          <text x={W - PAD.r} y={H - 8} className="pc-axis" textAnchor="end">
            {shortDate(new Date(geo.c[geo.c.length - 1].t).toISOString())}
          </text>
        </svg>
      )}
      <p className="note" style={{ margin: "6px 0 0" }}>
        {data?.source && data.source !== "none" ? `Live price from ${data.source}` : ""}
        {markers.length ? " · dashed lines = scheduled unlocks (Tokenomist)" : ""} · not a forecast
      </p>
    </section>
  );
}
