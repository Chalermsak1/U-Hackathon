// Alert engine v0 (AGENTIC-WORKFLOW §9): deterministic checks decide whether a rule fires (no
// LLM decides that), a cooldown stops repeats, and the agent writes the message U-Bot delivers.
// Runs on demand (POST /api/alerts/run); a cron can call the same function later.

import { runAgent } from "./agent";
import { assessUnlockRisk } from "./risk";
import { store, type AlertRule } from "./store";
import { thaiDate } from "./format";
import { getUBot } from "./ubot";
import type { RiskCard, RiskLevel } from "./types";

const COOLDOWN_MS = 12 * 3_600_000;
const RANK: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };
const LEVEL_TH: Record<RiskLevel, string> = { high: "สูง", medium: "ปานกลาง", low: "ต่ำ", none: "ไม่มี unlock ใกล้นี้" };

export interface AlertOutcome {
  ruleId: string;
  symbol: string;
  fired: boolean;
  /** Why it fired or not, in Thai, for the alerts page. */
  reason: string;
  level?: RiskLevel;
  score?: number;
  channelNote?: string;
}

/** Does this card meet the rule? Deterministic: level threshold plus the timing window. */
export function matches(rule: AlertRule, card: RiskCard): { ok: boolean; reason: string } {
  const level = `${LEVEL_TH[card.level]}${card.level === "none" ? "" : ` ${card.score}/100`}`;
  if (RANK[card.level] < RANK[rule.minLevel]) return { ok: false, reason: `ยังไม่ถึงเกณฑ์ (ตอนนี้ ${level})` };
  if (card.timing === "upcoming" && card.daysUntil !== null && card.daysUntil > rule.daysBefore) {
    return { ok: false, reason: `unlock อีก ${card.daysUntil} วัน เกินช่วง ${rule.daysBefore} วันที่ตั้งไว้` };
  }
  const when =
    card.timing === "continuous" ? "กำลังทยอยปลดล็อก" : card.unlockDate ? `unlock ${thaiDate(card.unlockDate)}` : "มี unlock";
  return { ok: true, reason: `เสี่ยง${level} · ${when}` };
}

/** Check every rule of one user; push the ones that fire into their U-Bot inbox. */
export async function runAlerts(userId: string, now: number): Promise<AlertOutcome[]> {
  const rules = store.alerts.filter((r) => r.ownerId === userId);
  const outcomes: AlertOutcome[] = [];
  for (const rule of rules) {
    const risk = await assessUnlockRisk(rule.symbol, null, { now, locale: "th" });
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
      const ago = mins < 60 ? `~${Math.max(1, mins)} นาทีก่อน` : `~${Math.round(mins / 60)} ชม.ก่อน`;
      outcomes.push({ ruleId: rule.id, symbol: rule.symbol, fired: false, reason: `เตือนไปแล้วเมื่อ${ago} (เว้น 12 ชม.)`, level: card.level, score: card.score });
      continue;
    }
    const result = await runAgent({ message: `เช็ก ${card.symbol} ให้หน่อย`, userId, scope: "user", now, route: "/api/alerts/run", locale: "th" });
    await getUBot().send(userId, "alert", result);
    store.alertsFired.set(key, now);
    outcomes.push({
      ruleId: rule.id,
      symbol: rule.symbol,
      fired: true,
      reason: m.reason,
      level: card.level,
      score: card.score,
      channelNote: rule.channel === "ubot" ? undefined : "LINE / Telegram ยังเป็น roadmap จึงส่งเข้า U-Bot ในแอปแทน",
    });
  }
  return outcomes;
}
