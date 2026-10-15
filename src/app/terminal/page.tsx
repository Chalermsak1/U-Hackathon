"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { CountUp, Spotlight, useTypewriter } from "@/components/fx";
import { LEVEL_TH, thb, thaiDate, untilText, usd, compact } from "@/lib/format";
import type { RiskCard } from "@/lib/types";

const PROMPTS = [
  "ซื้อ ARB 5,000 บาท ตอนนี้เสี่ยงไหม",
  "เหรียญไหนในพอร์ตฉันมี unlock ใน 30 วัน",
  "AVAX จะปลดล็อกให้ใครบ้าง",
  "อธิบาย FDV กับ float แบบง่ายๆ",
];

interface ScreenerRow {
  symbol: string;
  marketCap: number;
  fdv: number;
  floatPct: number | null;
  pctInvestorsUnlocked: number | null;
  analysed: boolean;
}

// Terminal home: ask U-Guard first, then the three things worth a glance.
export default function TerminalHome() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const placeholder = useTypewriter(PROMPTS);
  const [calendar, setCalendar] = useState<RiskCard[]>([]);
  const [lowFloat, setLowFloat] = useState<ScreenerRow[]>([]);
  const [portfolio, setPortfolio] = useState<{ totalThb: number; atRiskThb: number; rows: { symbol: string; card: RiskCard | null }[] } | null>(null);

  useEffect(() => {
    fetch("/api/calendar").then((r) => r.json()).then((b) => setCalendar(b.analysed ?? [])).catch(() => undefined);
    fetch("/api/screener")
      .then((r) => r.json())
      .then((b: { rows: ScreenerRow[] }) => setLowFloat([...b.rows].sort((a, z) => (a.floatPct ?? 100) - (z.floatPct ?? 100)).slice(0, 6)))
      .catch(() => undefined);
    fetch("/api/portfolio/risk").then((r) => r.json()).then(setPortfolio).catch(() => undefined);
  }, []);

  const go = (text: string) => {
    const t = text.trim();
    if (t) router.push(`/terminal/agent?q=${encodeURIComponent(t)}`);
  };

  return (
    <>
      <section className="hero-ask">
        <Avatar size={52} />
        <h1>
          วันนี้อยากรู้อะไร <em>ก่อนเงินขยับ?</em>
        </h1>
        <p>ถาม U-Guard เรื่องเหรียญ พอร์ต หรือปฏิทินปลดล็อก · ตอบเป็นภาษาไทยพร้อมแหล่งข้อมูล</p>
        <form
          className="askbox"
          onSubmit={(e) => {
            e.preventDefault();
            go(q);
          }}
        >
          <label htmlFor="home-ask" className="sr-only">
            ถาม U-Guard
          </label>
          <input id="home-ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoComplete="off" />
          <button className="btn btn-primary" type="submit" disabled={!q.trim()}>
            ถาม
          </button>
        </form>
        <div className="ask-chips">
          {PROMPTS.map((p) => (
            <button key={p} className="chip" onClick={() => go(p)}>
              {p}
            </button>
          ))}
        </div>
      </section>

      {portfolio && (
        <div className="kpis">
          <div className="kpi">
            <span>มูลค่าพอร์ต</span>
            <b>
              <CountUp value={portfolio.totalThb} format={thb} />
            </b>
          </div>
          <div className="kpi">
            <span>มูลค่าที่มี unlock เสี่ยงใน 30 วัน</span>
            <b style={{ color: portfolio.atRiskThb > 0 ? "var(--coral)" : undefined }}>
              <CountUp value={portfolio.atRiskThb} format={thb} />
            </b>
          </div>
          <div className="kpi">
            <span>unlock ที่ U-Guard ติดตาม</span>
            <b>
              <CountUp value={calendar.length} />
            </b>
            <small>เหรียญที่มีข้อมูลเต็ม</small>
          </div>
          <div className="kpi">
            <span>เหรียญใน screener</span>
            <b>
              <CountUp value={25} />
            </b>
            <small>Tokenomist fundraising</small>
          </div>
        </div>
      )}

      <div className="grid-2">
        <Spotlight className="panel">
          <div className="panel-head">
            <h2>Unlock ที่กำลังมา</h2>
            <Link href="/terminal/unlocks" className="total">
              ดูทั้งหมด →
            </Link>
          </div>
          {calendar.map((c) => (
            <Link key={c.symbol} href={`/terminal/tokens/${c.symbol}`} className="event-row" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="event-date">
                <b>{c.unlockDate ? thaiDate(c.unlockDate) : "–"}</b>
                {c.unlockDate ? untilText(c.unlockDate) : ""}
              </span>
              <span>
                <b>{c.symbol}</b> · {compact(c.amount)} ({usd(c.valueUsd)}) · {c.pctOfCirculating.toFixed(2)}% ของ circulating
              </span>
              <span className={`pill lv-${c.level}`}>
                {LEVEL_TH[c.level]} {c.score}
              </span>
            </Link>
          ))}
        </Spotlight>

        <Spotlight className="panel">
          <div className="panel-head">
            <h2>Float ต่ำที่สุด (supply ยังรอเข้าตลาด)</h2>
            <Link href="/terminal/tokens" className="total">
              screener →
            </Link>
          </div>
          {lowFloat.map((r) => (
            <div key={r.symbol} className="event-row" style={{ gridTemplateColumns: "70px 1fr auto" }}>
              <b>{r.symbol}</b>
              <span className="floatbar">
                <span>
                  <i style={{ width: `${r.floatPct ?? 0}%`, background: (r.floatPct ?? 0) < 40 ? "var(--coral)" : (r.floatPct ?? 0) < 70 ? "var(--amber)" : "var(--teal)" }} />
                </span>
                float {r.floatPct?.toFixed(0)}% · FDV {usd(r.fdv)}
              </span>
              <span className="note">นักลงทุนปลดล็อกแล้ว {r.pctInvestorsUnlocked ?? "–"}%</span>
            </div>
          ))}
        </Spotlight>
      </div>

      {portfolio && (
        <Spotlight className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <h2>พอร์ตของฉัน</h2>
            <Link href="/terminal/portfolio" className="total">
              ดูรายละเอียด →
            </Link>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {portfolio.rows.map((r) => (
              <Link key={r.symbol} href={`/terminal/tokens/${r.symbol}`} className={`pill lv-${r.card?.level ?? "none"}`} style={{ textDecoration: "none", fontSize: 13, padding: "4px 12px" }}>
                <span className="dot" /> {r.symbol} · {r.card ? LEVEL_TH[r.card.level] : "ไม่มี unlock"}
              </Link>
            ))}
          </div>
        </Spotlight>
      )}
    </>
  );
}
