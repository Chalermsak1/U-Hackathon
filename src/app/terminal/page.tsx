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
  "Scan my portfolio",
  "How far is my portfolio from my target mix?",
  "What's in the news for my coins?",
  "Who receives AVAX's unlocks?",
];

// The four steps of U-Guard, so a first-time user knows where to go next.
const STEPS = [
  { n: 1, title: "Check", text: "Screen tokens and see who unlocks what, when", href: "/terminal/tokens" },
  { n: 2, title: "Plan", text: "Your next 30 days, with dates and risk", href: "/terminal/plan" },
  { n: 3, title: "Approve", text: "U-Bot proposes; you decide, recorded on Avalanche", href: "/terminal/alerts" },
  { n: 4, title: "Stay alerted", text: "Rules watch your coins and ping U-Bot", href: "/terminal/alerts" },
];

interface PlanItemLite {
  date: string;
  kind: string;
  symbol: string | null;
  title: string;
  level: string | null;
  action: { label: string; href: string } | null;
}

// Terminal home: ask U-Guard first, then the three things worth a glance.
export default function TerminalHome() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const placeholder = useTypewriter(PROMPTS);
  const [calendar, setCalendar] = useState<RiskCard[]>([]);
  const [plan, setPlan] = useState<{ generatedAt: string; items: PlanItemLite[]; decisions: unknown[]; summary: string[] } | null>(null);
  const [portfolio, setPortfolio] = useState<{ totalThb: number; atRiskThb: number; rows: { symbol: string; card: RiskCard | null }[] } | null>(null);

  useEffect(() => {
    fetch("/api/calendar").then((r) => r.json()).then((b) => setCalendar(b.analysed ?? [])).catch(() => undefined);
    fetch("/api/plan")
      .then((r) => (r.ok ? r.json() : null))
      .then(setPlan)
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

      <ol className="flow-steps" aria-label="How U-Guard works">
        {STEPS.map((st) => (
          <li key={st.n}>
            <Link href={st.href}>
              <i>{st.n}</i>
              <b>{st.title}</b>
              <span>{st.text}</span>
            </Link>
          </li>
        ))}
      </ol>

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
              {calendar.length}
            </b>
            <small>tokens with full data</small>
          </div>
          <div className="kpi">
            <span>Decisions waiting</span>
            <b style={{ color: plan && plan.decisions.length ? "var(--amber)" : undefined }}>{plan ? plan.decisions.length : "…"}</b>
            <small>
              <Link href="/terminal/plan">open my plan →</Link>
            </small>
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
            <h2>Coming up for your money</h2>
            <Link href="/terminal/plan" className="total">
              My plan →
            </Link>
          </div>
          {!plan && <p className="note">Building your plan from live data…</p>}
          {plan?.items
            .filter((i) => i.kind !== "rule" && i.kind !== "stop")
            .slice(0, 5)
            .map((i, n) => (
              <Link key={`${i.date}-${n}`} href={i.action?.href.startsWith("/") ? i.action.href : "/terminal/plan"} className="event-row" style={{ textDecoration: "none", color: "inherit" }}>
                <span className="event-date">
                  <b>{i.date <= plan.generatedAt.slice(0, 10) ? "Today" : shortDate(i.date)}</b>
                  {i.kind === "release" ? "daily" : i.kind}
                </span>
                <span>{i.title}</span>
                {i.level ? <span className={`pill lv-${i.level}`}>{LEVEL_LABEL[i.level]}</span> : <span />}
              </Link>
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
