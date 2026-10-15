// Alert engine v0 (AGENTIC-WORKFLOW §9): deterministic checks decide whether a rule fires (no
// LLM decides that), a cooldown stops repeats, and the agent writes the message U-Bot delivers.
// Runs on demand (POST /api/alerts/run); a cron can call the same function later.

import { runAgent } from "./agent";
import { assessUnlockRisk } from "./risk";
import { store, type AlertRule } from "./store";
import { LEVEL_LABEL, shortDate } from "./format";
import { getUBot } from "./ubot";
import type { RiskCard, RiskLevel } from "./types";

const COOLDOWN_MS = 12 * 3_600_000;
const RANK: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };

export interface AlertOutcome {
  ruleId: string;
  symbol: string;
  fired: boolean;
  /** Why it fired or not, for the alerts page. */
  reason: string;
  level?: RiskLevel;
  score?: number;
  channelNote?: string;
}

/** Does this card meet the rule? Deterministic: level threshold plus the timing window. */
export function matches(rule: AlertRule, card: RiskCard): { ok: boolean; reason: string } {
  const level = card.level === "none" ? LEVEL_LABEL.none : `${LEVEL_LABEL[card.level]} risk ${card.score}/100`;
  if (RANK[card.level] < RANK[rule.minLevel]) return { ok: false, reason: `Below your threshold (now ${level})` };
  if (card.timing === "upcoming" && card.daysUntil !== null && card.daysUntil > rule.daysBefore) {
    return { ok: false, reason: `Unlock in ${card.daysUntil} days, outside your ${rule.daysBefore}-day window` };
  }
  const when =
    card.timing === "continuous" ? "releasing daily" : card.unlockDate ? `unlock ${shortDate(card.unlockDate)}` : "unlock ahead";
  return { ok: true, reason: `${level} · ${when}` };
}

/** Check every rule of one user; push the ones that fire into their U-Bot inbox. */
export async function runAlerts(userId: string, now: number): Promise<AlertOutcome[]> {
  const rules = store.alerts.filter((r) => r.ownerId === userId);
  const outcomes: AlertOutcome[] = [];
  for (const rule of rules) {
    const risk = await assessUnlockRisk(rule.symbol, null, { now, locale: "en" });
    if (!risk.ok) {
      outcomes.push({ ruleId: rule.id, symbol: rule.symbol, fired: false, reason: risk.reason });
      continue;
    }
    const card = risk.card;
    const m = matches(rule, card);
    if (!m.ok) {
      outcomes.push({ ruleId: rule.id, symbol: rule.symbol, fired: false, reason: m.reason, level: card.level, score: card.score });
      continue;
    }
    // One alert per rule and unlock event per cooldown window.
    const key = `${userId}:${rule.id}:${card.unlockDate ?? "none"}`;
    const last = store.alertsFired.get(key);
    if (last && now - last < COOLDOWN_MS) {
      const mins = Math.round((now - last) / 60_000);
      const ago = mins < 60 ? `~${Math.max(1, mins)} min ago` : `~${Math.round(mins / 60)} h ago`;
      outcomes.push({ ruleId: rule.id, symbol: rule.symbol, fired: false, reason: `Already alerted ${ago} (12 h cooldown)`, level: card.level, score: card.score });
      continue;
    }
    const result = await runAgent({ message: `Check ${card.symbol} for me`, userId, scope: "user", now, route: "/api/alerts/run", locale: "en" });
    await getUBot().send(userId, "alert", result);
    store.alertsFired.set(key, now);
    outcomes.push({
      ruleId: rule.id,
      symbol: rule.symbol,
      fired: true,
      reason: m.reason,
      level: card.level,
      score: card.score,
      channelNote: rule.channel === "ubot" ? undefined : "LINE / Telegram is on the roadmap, so this went to the in-app U-Bot inbox",
    });
  }
  return outcomes;
}
