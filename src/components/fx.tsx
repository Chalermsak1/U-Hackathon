"use client";

// Small motion helpers ("ลูกเล่น"). Every one of them is skipped when the user prefers
// reduced motion.

import { useEffect, useRef, useState } from "react";
import type { RecipientClass } from "@/lib/types";

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Counts up to `value` once it scrolls into view. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString("en-US"), duration = 900 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (reducedMotion()) {
      setShown(value);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        setShown(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      // Background tabs pause animation frames; always land on the real number.
      settle = setTimeout(() => setShown(value), duration + 150);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [value, duration]);
  return <span ref={ref}>{format(shown)}</span>;
}

/** Placeholder text that types itself, cycling through examples. */
export function useTypewriter(lines: string[], speed = 45, pause = 1600): string {
  const [text, setText] = useState(lines[0] ?? "");
  useEffect(() => {
    if (reducedMotion() || lines.length === 0) return;
    let line = 0;
    let i = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const full = lines[line];
      if (!deleting) {
        i++;
        setText(full.slice(0, i));
        if (i >= full.length) {
          deleting = true;
          timer = setTimeout(step, pause);
          return;
        }
      } else {
        i--;
        setText(full.slice(0, i));
        if (i <= 0) {
          deleting = false;
          line = (line + 1) % lines.length;
        }
      }
      timer = setTimeout(step, deleting ? speed / 2 : speed);
    };
    timer = setTimeout(step, speed);
    return () => clearTimeout(timer);
  }, [lines, speed, pause]);
  return text;
}

/** Card with a soft light that follows the pointer. */
export function Spotlight({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`spot ${className}`}
      style={style}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r || !ref.current) return;
        ref.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
        ref.current.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}

/** Fades children in when they scroll into view. */
export function Reveal({ children, delay = 0, as: Tag = "div", className = "" }: { children: React.ReactNode; delay?: number; as?: "div" | "section"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (reducedMotion()) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${shown ? "reveal-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

export const RECIPIENT_COLOR: Record<RecipientClass, string> = {
  team: "#FB7151",
  investor: "#FBBF24",
  community: "#94A3B8",
  other: "#64748B",
  reserve: "#A78BFA",
  ecosystem: "#2DD4BF",
};
export const RECIPIENT_LABEL: Record<RecipientClass, string> = {
  team: "ทีม",
  investor: "นักลงทุน",
  community: "ชุมชน",
  other: "อื่นๆ",
  reserve: "เงินสำรอง",
  ecosystem: "กองทุน ecosystem",
};

/** Stacked monthly bars by recipient; bars grow in on mount. */
export function StackedBars({
  months,
  height = 220,
}: {
  months: { month: string; total: number; byRecipient: Partial<Record<RecipientClass, number>> }[];
  height?: number;
}) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(t);
  }, []);
  const max = Math.max(1, ...months.map((m) => m.total));
  const w = 640;
  const pad = { l: 44, r: 8, t: 10, b: 26 };
  const bw = Math.min(46, (w - pad.l - pad.r) / months.length - 14);
  const plotH = height - pad.t - pad.b;
  const order: RecipientClass[] = ["team", "investor", "community", "reserve", "other", "ecosystem"];
  const fmt = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(0)}M` : `${Math.round(n / 1e3)}K`);
  const label = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("th-TH", { month: "short", year: "2-digit", timeZone: "UTC" });

  return (
    <svg className="bars" viewBox={`0 0 ${w} ${height}`} role="img" aria-label="เหรียญที่จะปลดล็อกรายเดือน แยกตามผู้รับ">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={w - pad.r} y1={pad.t + plotH * (1 - f)} y2={pad.t + plotH * (1 - f)} stroke="rgba(232,241,245,0.08)" />
          <text x={pad.l - 8} y={pad.t + plotH * (1 - f) + 4} textAnchor="end" fontSize="11" fill="#74879c">
            {fmt(max * f)}
          </text>
        </g>
      ))}
      {months.map((m, i) => {
        const x = pad.l + 10 + i * ((w - pad.l - pad.r - 10) / months.length);
        let y = pad.t + plotH;
        return (
          <g key={m.month}>
            {order.map((r) => {
              const v = m.byRecipient[r] ?? 0;
              if (!v) return null;
              const h = (v / max) * plotH;
              y -= h;
              return (
                <rect
                  key={r}
                  x={x}
                  y={grown ? y : pad.t + plotH}
                  width={bw}
                  height={grown ? Math.max(0, h - 2) : 0}
                  rx="3"
                  fill={RECIPIENT_COLOR[r]}
                  style={{ transition: "all 700ms cubic-bezier(.2,.8,.2,1)", transitionDelay: `${i * 60}ms` }}
                >
                  <title>{`${label(m.month)} · ${RECIPIENT_LABEL[r]} ${fmt(v)}`}</title>
                </rect>
              );
            })}
            <text x={x + bw / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#74879c">
              {label(m.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
