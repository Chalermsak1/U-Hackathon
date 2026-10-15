"use client";

// Hero scene for the landing page, built from what U-Guard actually does rather than a
// decorative orbit: it watches the next 30 days of unlocks, each event slides up to the
// scan line, the mark reacts in the risk colour, a 3-line Thai explanation appears, and
// the user approves the proposal. Bars are stacked by recipient in the same colours as
// the terminal's supply chart.
//
// Data: Tokenomist API snapshot of 16 Oct 2026 (unlock events + daily emission) and the
// scores U-Guard gives them. WLD releases every day, so it is drawn as a band, not a bar.
// CRO and DBR come from unlock-calendar.json (not analysed, shown grey).

import { useEffect, useRef, useState } from "react";
import type { RecipientClass, RiskLevel } from "@/lib/types";
import { LEVEL_TH } from "@/lib/format";
import { RECIPIENT_COLOR } from "./fx";
import { GuardMark } from "./GuardMark";

const AS_OF = Date.UTC(2026, 9, 16);
const WINDOW_DAYS = 30;
const STEP_MS = 4600;
const SLIDE_MS = 1100;

interface WatchEvent {
  sym: string;
  day: number; // days after AS_OF
  amount: string;
  pct: number; // % of circulating supply
  parts: [RecipientClass, number][];
  level: RiskLevel;
  score: number;
  lines: [string, string, string];
  proposal: string | null;
  when: string; // shown in the card header
  span?: number; // days: a continuous release, drawn as a band
}

const EVENTS: WatchEvent[] = [
  {
    sym: "ARB",
    day: 0,
    amount: "92.65M",
    pct: 1.37,
    parts: [["team", 0.61], ["investor", 0.39]],
    level: "high",
    score: 67,
    lines: ["ปลดล็อก 92.65M ARB หรือ 1.37% ของเหรียญที่หมุนเวียน", "ผู้รับคือทีม 61% และนักลงทุน 39%", "unlock แบบนี้ราคามักถูกกดตั้งแต่ก่อนถึงวัน"],
    proposal: "พักการซื้อ ARB ช่วง unlock",
    when: "วันนี้ 20:00 น.",
  },
  {
    sym: "WLD",
    day: 1,
    span: 28,
    amount: "~2.9M/วัน",
    pct: 2.28,
    parts: [["community", 0.55], ["investor", 0.26], ["team", 0.19]],
    level: "medium",
    score: 39,
    lines: ["ทยอยปลดล็อกทุกวัน ~87M WLD ใน 30 วัน (2.28%)", "ชุมชน 55% · นักลงทุน 26% · ทีม 19%", "ไม่ใช่ก้อนเดียว แต่ไหลเข้าตลาดต่อเนื่อง"],
    proposal: "เตือนเมื่อราคาลด 10%",
    when: "ทุกวัน",
  },
  {
    sym: "AVAX",
    day: 23,
    amount: "1.67M",
    pct: 0.38,
    parts: [["reserve", 1]],
    level: "low",
    score: 22,
    lines: ["ปลดล็อก 1.67M AVAX ให้ Foundation (0.38%)", "ที่ทยอยออกทุกวันส่วนใหญ่คือรางวัล staking", "ไม่ต้องทำอะไร U-Guard จะเฝ้าดูต่อ"],
    proposal: null,
    when: "8 พ.ย.",
  },
];

// Other scheduled unlocks on the calendar (CRO and DBR on 17 Oct, ARB's next monthly
// cliff). Context only: unlabelled, grey, and kept shorter than the analysed bars.
const GHOSTS = [
  { key: "cro-dbr", day: 1, pct: 10 },
  { key: "arb-nov", day: 31, pct: 1.37 },
];

const barHeight = (pct: number) => Math.min(96, 18 + Math.sqrt(pct / 3) * 70);
const pos = (day: number) => `calc(8% + ${(day / WINDOW_DAYS) * 100}%)`;
const dateTh = (day: number) =>
  new Date(AS_OF + day * 86_400_000).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });

export function GuardWatch() {
  const [focus, setFocus] = useState(0); // event the track is sliding to
  const [hit, setHit] = useState(0); // event U-Guard has checked
  const [react, setReact] = useState(0);
  const [approved, setApproved] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [running, setRunning] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Only animate while on screen, and never under reduced motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    let reported = false;
    const io = new IntersectionObserver(
      ([e]) => {
        reported = true;
        setRunning(e.isIntersecting);
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    // Some webviews and throttled panes never deliver observer callbacks; don't freeze the hero.
    const fallback = setTimeout(() => !reported && setRunning(true), 1500);
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let i = hit;
    const step = () => {
      i = (i + 1) % EVENTS.length;
      setFocus(i);
      setScanning(true);
      timers.push(
        setTimeout(() => {
          setHit(i);
          setApproved(false);
          setScanning(false);
          setReact((r) => r + 1);
        }, SLIDE_MS),
      );
      if (EVENTS[i].proposal) timers.push(setTimeout(() => setApproved(true), SLIDE_MS + 1700));
      timers.push(setTimeout(step, STEP_MS));
    };
    // First pass: react to the event already under the scan line, then move on.
    setReact((r) => r + 1);
    timers.push(setTimeout(() => setApproved(true), 1700));
    timers.push(setTimeout(step, STEP_MS));
    return () => timers.forEach(clearTimeout);
    // `hit` is read once to resume from where the scene paused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const ev = EVENTS[hit];
  const look = pointer ?? (scanning ? { x: 4, y: 0 } : { x: 1, y: 3 });

  return (
    <div
      ref={ref}
      className="gw"
      role="img"
      aria-label="ตัวอย่างการทำงาน: U-Guard เฝ้าตาราง unlock 30 วันข้างหน้า เช่น ARB จะปลดล็อก 92.65M คืนนี้ 20:00 น. ผู้รับคือทีมและนักลงทุน จึงเสี่ยงสูง และเสนอให้พักการซื้อ ซึ่งผู้ใช้เป็นคนอนุมัติ"
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        setPointer({ x: ((e.clientX - r.left) / r.width - 0.2) * 10, y: ((e.clientY - r.top) / r.height - 0.3) * 10 });
      }}
      onPointerLeave={() => setPointer(null)}
    >
      <div className="gw-head" aria-hidden="true">
        <span className="gw-live" />
        <b>U-Guard Watch</b>
        <span>ตาราง unlock 30 วันข้างหน้า</span>
      </div>

      <div className="gw-stage" aria-hidden="true">
        <div className="gw-mark">
          <GuardMark level={ev.level} look={look} react={react} size={104} />
        </div>
        <div className="gw-window">
          <div className="gw-track" style={{ transform: `translateX(${(-EVENTS[focus].day / WINDOW_DAYS) * 100}%)` }}>
            {[0, 7, 14, 21, 28, 35, 42].map((d) => (
              <span key={d} className="gw-tick" style={{ left: pos(d) }}>
                {dateTh(d)}
              </span>
            ))}
            {GHOSTS.map((g) => (
              <span key={g.key} className="gw-bar gw-ghost" style={{ left: pos(g.day), height: Math.min(44, barHeight(g.pct)) }} />
            ))}
            {EVENTS.map((e, i) => (
              <span
                key={e.sym}
                className={`gw-bar ${i === hit && !scanning ? "gw-bar-on" : ""} ${e.day < EVENTS[focus].day ? "gw-past" : ""}`}
                style={
                  e.span
                    ? { left: pos(e.day), height: 14, width: `${(e.span / WINDOW_DAYS) * 100}%`, marginLeft: 0, flexDirection: "row" }
                    : { left: pos(e.day), height: barHeight(e.pct) }
                }
              >
                {e.parts.map(([r, share]) => (
                  <i key={r} style={{ flexGrow: share, background: RECIPIENT_COLOR[r] }} />
                ))}
                <em>
                  {e.sym}
                  {i === hit && !scanning ? ` · ${e.amount}` : ""}
                </em>
              </span>
            ))}
          </div>
          <span key={react} className={`gw-scan ${scanning ? "gw-scan-busy" : `gw-scan-${ev.level}`}`} />
        </div>
      </div>

      <div className={`gw-card gw-card-${ev.level}`} aria-hidden="true">
        <div className="gw-card-head">
          <b>{ev.sym}</b>
          <span>
            {ev.when}
          </span>
          <span className={`gw-voice ${scanning ? "" : "gw-voice-on"}`} key={`v${react}`}>
            <i />
            <i />
            <i />
          </span>
          <span className={`gw-level gw-level-${ev.level}`}>
            {LEVEL_TH[ev.level]} {ev.score}
          </span>
        </div>
        <ol key={hit} className={scanning ? "gw-dim" : ""}>
          {ev.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>
        <div className="gw-action">
          {ev.proposal ? (
            <span className={`gw-chip ${approved ? "gw-chip-ok" : ""}`}>
              {approved ? `✓ คุณอนุมัติแล้ว · บันทึกบน Avalanche` : `ข้อเสนอ: ${ev.proposal} · รอคุณอนุมัติ`}
            </span>
          ) : (
            <span className="gw-chip gw-chip-calm">ไม่มีข้อเสนอ · ไม่เตือนพร่ำเพรื่อ</span>
          )}
        </div>
      </div>
      <p className="gw-foot" aria-hidden="true">
        ข้อมูลจริงจาก Tokenomist API 16 ต.ค. · แถบยาว = ทยอยปลดล็อกทุกวัน · แท่งสีเทา = unlock อื่นในปฏิทิน · ไม่ใช่คำแนะนำการลงทุน
      </p>
    </div>
  );
}
