// Portfolio stress test: what each scenario would do to the user's money, in baht, and how they
// can handle it. Scenarios are arithmetic on today's holdings, not forecasts: a move the options
// market prices for BTC, the average price move around past team unlocks (Keyrock), and a plain
// crypto drawdown. Handling options are protections the user can choose; nothing says buy or sell.

import { portfolioRisk, type HoldingRisk } from "./drift";
import { compact, LEVEL_LABEL, shortDate } from "./format";
import { getMarketPulse } from "./intel/pulse";
import type { Locale } from "./types";

const STABLES = new Set(["USDC", "USDT", "DAI"]);
const TEAM_UNLOCK_AVG_PCT = -25; // Keyrock, 16,000+ unlock events (see risk.ts)
const DRAWDOWN_PCT = -20;

export interface StressScenario {
  id: "implied" | "unlocks" | "drawdown";
  label: string;
  basis: string;
  impactThb: number; // negative = loss
  impactPct: number; // of the whole portfolio
  rows: { symbol: string; valueThb: number; movePct: number; impactThb: number }[];
}

export interface StressHandle {
  symbol: string;
  text: string;
  action: { label: string; href: string };
}

export interface StressReport {
  totalThb: number;
  cryptoThb: number;
  stableThb: number;
  scenarios: StressScenario[];
  handles: StressHandle[];
  lines: string[];
}

function scenario(id: StressScenario["id"], label: string, basis: string, rows: HoldingRisk[], move: (r: HoldingRisk) => number, totalThb: number): StressScenario {
  const hit = rows
    .map((r) => ({ symbol: r.symbol, valueThb: r.valueThb, movePct: move(r), impactThb: Math.round((r.valueThb * move(r)) / 100) }))
    .filter((r) => r.movePct !== 0);
  const impactThb = hit.reduce((s, r) => s + r.impactThb, 0);
  return { id, label, basis, impactThb, impactPct: totalThb > 0 ? (impactThb / totalThb) * 100 : 0, rows: hit };
}

export async function stressTest(userId: string, opts: { locale?: Locale; now?: number } = {}): Promise<StressReport> {
  const [{ rows, totalThb }, pulse] = await Promise.all([portfolioRisk({ ...opts, userId }), getMarketPulse()]);
  const crypto = rows.filter((r) => !STABLES.has(r.symbol) && r.valueThb > 0);
  const cryptoThb = crypto.reduce((s, r) => s + r.valueThb, 0);
  const scenarios: StressScenario[] = [];

  const im = pulse.data.impliedMove;
  if (im) {
    scenarios.push(
      scenario(
        "implied",
        `Options-implied ${im.days}-day drop (−${im.pct.toFixed(1)}%)`,
        `The 1-sigma ${im.days}-day range the options market prices for ${im.asset}, applied to all your crypto (altcoins usually move more)`,
        crypto,
        () => -Number(im.pct.toFixed(1)),
        totalThb,
      ),
    );
  }
  const risky = crypto.filter((r) => r.card && (r.card.level === "high" || r.card.level === "medium") && r.card.timing !== "continuous");
  if (risky.length) {
    scenarios.push(
      scenario(
        "unlocks",
        `Your risky unlocks go like past team unlocks (${TEAM_UNLOCK_AVG_PCT}%)`,
        "Keyrock's average price move around team unlocks (16,000+ events), applied only to holdings with a medium or high unlock ahead",
        risky,
        () => TEAM_UNLOCK_AVG_PCT,
        totalThb,
      ),
    );
  }
  scenarios.push(scenario("drawdown", `Crypto falls ${-DRAWDOWN_PCT}%`, "A plain drawdown of all crypto, for scale", crypto, () => DRAWDOWN_PCT, totalThb));

  const handles: StressHandle[] = [];
  for (const r of crypto.sort((a, b) => b.valueThb - a.valueThb)) {
    const c = r.card;
    if (c && (c.level === "high" || c.level === "medium")) {
      const when = c.timing === "continuous" ? "while it releases daily" : c.unlockDate ? `before ${shortDate(c.unlockDate)}` : "before the unlock";
      handles.push({
        symbol: r.symbol,
        text: `${r.symbol} (${r.weightPct.toFixed(0)}% of your portfolio, ${LEVEL_LABEL[c.level].toLowerCase()} unlock risk): a price alert or pausing auto-buys ${when} limits surprises; a stop-loss at your own level caps the loss (−10% would be about ${compact(r.valueThb * 0.1)} THB).`,
        action: { label: "Protect", href: `/terminal/tokens/${r.symbol}` },
      });
    } else if (r.weightPct > 40) {
      handles.push({
        symbol: r.symbol,
        text: `${r.symbol} is ${r.weightPct.toFixed(0)}% of your portfolio: one token moves most of your money. Compare it with your target mix.`,
        action: { label: "Portfolio", href: "/terminal/portfolio" },
      });
    }
  }

  const worst = [...scenarios].sort((a, b) => a.impactThb - b.impactThb)[0];
  const stablePct = totalThb > 0 ? ((totalThb - cryptoThb) / totalThb) * 100 : 0;
  const lines = [
    worst ? `Worst case tested: ${worst.label.toLowerCase()} would cost about ${compact(-worst.impactThb)} THB (${Math.abs(worst.impactPct).toFixed(1)}% of your portfolio).` : "No crypto holdings to stress.",
    `${stablePct.toFixed(0)}% of your portfolio is in stablecoins, which these scenarios don't touch.`,
    handles.length ? `${handles.length} holding${handles.length === 1 ? "" : "s"} can be protected now; you choose how.` : "No holding needs protection for these scenarios.",
  ];

  return { totalThb, cryptoThb, stableThb: totalThb - cryptoThb, scenarios, handles, lines };
}
