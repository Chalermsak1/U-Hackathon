"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { CountUp, Spotlight, useTypewriter } from "@/components/fx";
import { LEVEL_LABEL, thb, shortDate, unlockWhen, usd, compact } from "@/lib/format";
import type { RiskCard } from "@/lib/types";

const PROMPTS = [
  "Is buying 5,000 THB of ARB risky right now?",
  "Which of my tokens unlock in the next 30 days?",
  "Who receives AVAX's unlocks?",
  "Explain FDV and float simply",
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
          What do you want to know <em>before your money moves?</em>
        </h1>
        <p>Ask U-Guard about a token, your portfolio or the unlock calendar · answers in your language, with sources</p>
        <form
          className="askbox"
          onSubmit={(e) => {
            e.preventDefault();
            go(q);
          }}
        >
          <label htmlFor="home-ask" className="sr-only">
            Ask U-Guard
          </label>
          <input id="home-ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoComplete="off" />
          <button className="btn btn-primary" type="submit" disabled={!q.trim()}>
            Ask
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
            <span>Portfolio value</span>
            <b>
              <CountUp value={portfolio.totalThb} format={thb} />
            </b>
          </div>
          <div className="kpi">
            <span>Value facing a risky unlock (30 days)</span>
            <b style={{ color: portfolio.atRiskThb > 0 ? "var(--coral)" : undefined }}>
              <CountUp value={portfolio.atRiskThb} format={thb} />
            </b>
          </div>
          <div className="kpi">
            <span>Unlocks U-Guard tracks</span>
            <b>
              <CountUp value={calendar.length} />
            </b>
            <small>tokens with full data</small>
          </div>
          <div className="kpi">
            <span>Tokens in the screener</span>
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
            <h2>Upcoming unlocks</h2>
            <Link href="/terminal/unlocks" className="total">
              See all →
            </Link>
          </div>
          {calendar.map((c) => (
            <Link key={c.symbol} href={`/terminal/tokens/${c.symbol}`} className="event-row" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="event-date">
                <b>{c.unlockDate ? shortDate(c.unlockDate) : "–"}</b>
                {unlockWhen(c)}
              </span>
              <span>
                <b>{c.symbol}</b> · {compact(c.amount)} ({usd(c.valueUsd)}) · {c.pctOfCirculating.toFixed(2)}% of circulating
              </span>
              <span className={`pill lv-${c.level}`}>
                {LEVEL_LABEL[c.level]} {c.score}
              </span>
            </Link>
          ))}
        </Spotlight>

        <Spotlight className="panel">
          <div className="panel-head">
            <h2>Lowest float (supply still to come)</h2>
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
              <span className="note">investors unlocked {r.pctInvestorsUnlocked ?? "–"}%</span>
            </div>
          ))}
        </Spotlight>
      </div>

      {portfolio && (
        <Spotlight className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <h2>My portfolio</h2>
            <Link href="/terminal/portfolio" className="total">
              Details →
            </Link>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {portfolio.rows.map((r) => (
              <Link key={r.symbol} href={`/terminal/tokens/${r.symbol}`} className={`pill lv-${r.card?.level ?? "none"}`} style={{ textDecoration: "none", fontSize: 13, padding: "4px 12px" }}>
                <span className="dot" /> {r.symbol} · {r.card ? LEVEL_LABEL[r.card.level] : "No unlock"}
              </Link>
            ))}
          </div>
        </Spotlight>
      )}
    </>
  );
}
