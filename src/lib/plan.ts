// My plan: one dated timeline for the next 30 days of the user's money. It joins what U-Guard
// already knows (unlocks of the coins they hold, Fed dates, their DCA buys, open decisions,
// active alert rules and paper stop-losses) and says, per item, what is known and what the user
// can do. Everything is deterministic; nothing here recommends buying or selling.

import { checkDrift, portfolioRisk } from "./drift";
import { compact, LEVEL_LABEL, shortDate, usd } from "./format";
import { getEventCalendar } from "./intel/calendar";
import { store } from "./store";
import type { DriftReport, Locale, Proposal, RiskCard, RiskLevel } from "./types";

export const PLAN_DAYS = 30;

export interface PlanItem {
  date: string; // YYYY-MM-DD
  kind: "unlock" | "release" | "macro" | "dca" | "decision" | "rule" | "stop";
  symbol: string | null;
  title: string;
  detail: string;
  level: RiskLevel | null;
  action: { label: string; href: string } | null;
}

export interface MyPlan {
  generatedAt: string;
  horizonDays: number;
  items: PlanItem[];
  decisions: Proposal[];
  cards: RiskCard[];
  drift: DriftReport;
  totalThb: number;
  summary: string[];
}

const DAY = 86_400_000;
const day = (iso: string) => iso.slice(0, 10);

function unlockAdvice(card: RiskCard): string {
  if (card.level === "high") return "High risk: consider pausing auto-buys or setting a price alert before this date (you decide).";
  if (card.level === "medium") return "Medium risk: a price alert before this date keeps you informed.";
  return "Low risk: nothing to do; U-Guard keeps watching.";
}

export async function buildPlan(userId: string, opts: { now: number; locale?: Locale }): Promise<MyPlan> {
  const { now } = opts;
  const today = day(new Date(now).toISOString());
  const end = day(new Date(now + PLAN_DAYS * DAY).toISOString());
  const inWindow = (d: string) => d >= today && d <= end;

  const [pre, calendar] = await Promise.all([portfolioRisk({ locale: opts.locale, now }), getEventCalendar(PLAN_DAYS, { now })]);
  const drift = await checkDrift(userId, { locale: opts.locale, now, pre });
  const items: PlanItem[] = [];
  const cards = pre.rows.flatMap((r) => (r.card ? [r.card] : []));
  const held = new Set(pre.rows.map((r) => r.symbol));

  // 1. Unlocks of what the user holds (cliffs and continuous releases), with the next cliff too.
  for (const r of pre.rows) {
    const c = r.card;
    if (!c || c.level === "none" || !c.unlockDate) continue;
    const share = r.weightPct >= 1 ? ` · ${r.weightPct.toFixed(0)}% of your portfolio` : "";
    if (c.timing === "continuous") {
      items.push({
        date: today,
        kind: "release",
        symbol: c.symbol,
        title: `${c.symbol} releases ~${compact(c.amount)} over ${c.windowDays ?? PLAN_DAYS} days`,
        detail: `${c.pctOfCirculating.toFixed(2)}% of circulating supply, every day rather than one cliff${share}. ${LEVEL_LABEL[c.level]} risk ${c.score}/100.`,
        level: c.level,
        action: { label: "See the token", href: `/terminal/tokens/${c.symbol}` },
      });
    } else if (inWindow(day(c.unlockDate)) || day(c.unlockDate) === today) {
      items.push({
        date: day(c.unlockDate),
        kind: "unlock",
        symbol: c.symbol,
        title: `${c.symbol} unlocks ${compact(c.amount)} (${usd(c.valueUsd)})`,
        detail: `${c.pctOfCirculating.toFixed(2)}% of circulating supply${share}. ${LEVEL_LABEL[c.level]} risk ${c.score}/100. ${unlockAdvice(c)}`,
        level: c.level,
        action: { label: c.level === "high" || c.level === "medium" ? "Protect this position" : "See the token", href: `/terminal/tokens/${c.symbol}` },
      });
    }
    if (c.nextUnlock && inWindow(day(c.nextUnlock.date))) {
      items.push({
        date: day(c.nextUnlock.date),
        kind: "unlock",
        symbol: c.symbol,
        title: `${c.symbol} unlocks ${compact(c.nextUnlock.amount)} again`,
        detail: "The next scheduled cliff of the same vesting plan.",
        level: null,
        action: { label: "See the schedule", href: `/terminal/tokens/${c.symbol}` },
      });
    }
  }

  // 2. Market-wide dates (Fed decisions); token unlocks of coins the user doesn't hold are left out.
  for (const e of calendar) {
    if (e.kind !== "macro" || !inWindow(e.date)) continue;
    items.push({
      date: e.date,
      kind: "macro",
      symbol: null,
      title: e.title,
      detail: "Scheduled macro event: crypto often moves around it. Check the market odds before trading that day.",
      level: e.importance === "high" ? "medium" : "low",
      action: { label: "Ask U-Bot about it", href: `/terminal/agent?q=${encodeURIComponent(`What do markets expect from ${e.title}?`)}` },
    });
  }
  // Unlocks on the calendar for coins the user holds but U-Guard had no card for.
  for (const e of calendar) {
    if (e.kind === "unlock" && e.symbol && held.has(e.symbol) && inWindow(e.date) && !items.some((i) => i.symbol === e.symbol && i.date === e.date)) {
      items.push({ date: e.date, kind: "unlock", symbol: e.symbol, title: e.title, detail: "Scheduled unlock of a coin you hold.", level: null, action: { label: "See the token", href: `/terminal/tokens/${e.symbol}` } });
    }
  }

  // 3. Decisions waiting for the user, and rules they approved.
  const mine = [...store.proposals.values()].filter((p) => p.ownerId === userId);
  const decisions = mine.filter((p) => p.proposal.status === "pending").map((p) => p.proposal);
  for (const p of decisions) {
    items.push({
      date: today,
      kind: "decision",
      symbol: p.symbol,
      title: `Decide: ${p.title}`,
      detail: `${p.detail}${p.unlockDate ? ` Best before ${shortDate(p.unlockDate)}.` : ""}`,
      level: p.riskLevel,
      action: null,
    });
  }
  for (const p of mine.filter((r) => r.proposal.status === "approved")) {
    items.push({
      date: today,
      kind: "rule",
      symbol: p.proposal.symbol,
      title: `Active: ${p.proposal.title}`,
      detail: p.receipt?.txHash ? `Approved and recorded on ${p.receipt.chain}.` : "Approved by you.",
      level: null,
      action: p.receipt?.explorerUrl ? { label: "Receipt", href: p.receipt.explorerUrl } : null,
    });
  }
  for (const a of store.alerts.filter((r) => r.ownerId === userId)) {
    items.push({
      date: today,
      kind: "rule",
      symbol: a.symbol,
      title: `Alert: ${a.symbol} ${a.minLevel === "high" ? "high" : "medium or high"} risk, ${a.daysBefore} days before an unlock`,
      detail: "U-Guard checks it on a timer and sends it to your U-Bot inbox.",
      level: null,
      action: { label: "Alerts", href: "/terminal/alerts" },
    });
  }

  // 4. DCA buys from approved invest plans, and stop-losses of paper orders.
  for (const { plan } of [...store.investPlans.values()].filter((r) => r.ownerId === userId && r.plan.status === "approved")) {
    for (const d of plan.dca.filter((x) => inWindow(x.date))) {
      items.push({
        date: d.date,
        kind: "dca",
        symbol: null,
        title: `DCA buy of ${compact(d.amountThb)} THB ("${plan.profileName}" plan)`,
        detail: d.notes.length ? d.notes.join(" · ") : "No big unlock near this date for the coins in your plan.",
        level: d.notes.length ? "medium" : null,
        action: { label: "Invest plan", href: "/terminal/invest" },
      });
    }
  }
  for (const o of (store.orders.get(userId) ?? []).filter((x) => x.side === "buy")) {
    items.push({
      date: today,
      kind: "stop",
      symbol: o.symbol,
      title: `Stop-loss for ${o.symbol} at $${o.stopPriceUsd.toPrecision(4)}`,
      detail: `From your paper buy of ${compact(o.amountThb)} THB on ${shortDate(o.at)}.`,
      level: null,
      action: { label: "Trade", href: "/terminal/trade" },
    });
  }

  const order = { decision: 0, unlock: 1, release: 2, macro: 3, dca: 4, stop: 5, rule: 6 } as const;
  items.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind]);

  const risky = items.filter((i) => (i.kind === "unlock" || i.kind === "release") && (i.level === "high" || i.level === "medium"));
  const nextDated = items.find((i) => i.kind === "unlock" || i.kind === "macro" || i.kind === "dca");
  const summary = [
    decisions.length ? `${decisions.length === 1 ? "One decision waits" : `${decisions.length} decisions wait`} for you.` : "No decisions waiting.",
    risky.length ? `${risky.length} unlock${risky.length === 1 ? "" : "s"} with medium or high risk touch coins you hold in the next ${PLAN_DAYS} days.` : `No risky unlock touches your coins in the next ${PLAN_DAYS} days.`,
    nextDated ? `Next date: ${nextDated.date === today ? "today" : shortDate(nextDated.date)}, ${nextDated.title}.` : "",
    drift.lines[0] ?? "",
  ].filter(Boolean);

  return { generatedAt: new Date(now).toISOString(), horizonDays: PLAN_DAYS, items, decisions, cards, drift, totalThb: pre.totalThb, summary };
}
