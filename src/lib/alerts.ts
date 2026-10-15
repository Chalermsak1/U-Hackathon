// Alert engine (AGENTIC-WORKFLOW §9). For one user:
//   1. fetch fresh data through the agent's own tools (same Agent Trace as a chat)
//   2. evaluate every rule in code: no model decides whether to alert
//   3. dedupe, quiet hours (22:00–07:00 Bangkok: high severity only), daily cap
//   4. send one U-Bot message with the alerts, their cards and protective proposals
// Rule types: unlock (scheduled supply), drift (wallet off the user's own target mix), news.
// Messages are composed deterministically, so they can't drift into advice.

import { randomUUID } from "node:crypto";
import { executeTool, newContext, type RunContext } from "./agent/tools";
import { config } from "./config";
import { thaiDate, untilText } from "./format";
import { getHoldings } from "./portfolio";
import { store, type AlertEvent, type AlertRule, type AlertType, type WatchSummary } from "./store";
import type { AgentResult, NewsItem, RiskCard, RiskLevel } from "./types";
import { getUBot } from "./ubot";

const STABLES = new Set(["USDC", "USDT", "DAI"]);
const RANK: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };
const SEV = { medium: 2, high: 3 } as const;
const LEVEL_TH: Record<RiskLevel, string> = { high: "สูง", medium: "ปานกลาง", low: "ต่ำ", none: "ไม่มี unlock ใกล้นี้" };
const SERIOUS = /hack|exploit|breach|lawsuit|sued|sec|delist|regulat|ban|bankrupt|insolv|halt/i;

export interface AlertOutcome {
  ruleId: string;
  symbol: string;
  fired: boolean;
  /** Why it fired or not, in Thai, for the alerts page. */
  reason: string;
  channelNote?: string;
}

type Candidate = Omit<AlertEvent, "id" | "firedAt" | "ownerId">;

const bangkokDay = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

export function inQuietHours(nowMs: number): boolean {
  const h = Number(new Date(nowMs).toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Bangkok" }));
  const { quietStartHour: start, quietEndHour: end } = config.watch;
  if (start === end) return false;
  return start > end ? h >= start || h < end : h >= start && h < end;
}

/** Does this card meet an unlock rule? Level threshold plus the timing window. */
export function matches(rule: Pick<AlertRule, "minLevel" | "daysBefore">, card: RiskCard): { ok: boolean; reason: string } {
  const level = `${LEVEL_TH[card.level]}${card.level === "none" ? "" : ` ${card.score}/100`}`;
  if (RANK[card.level] < RANK[rule.minLevel]) return { ok: false, reason: `ยังไม่ถึงเกณฑ์ (ตอนนี้ ${level})` };
  if (card.timing === "upcoming" && card.daysUntil !== null && card.daysUntil > rule.daysBefore) {
    return { ok: false, reason: `unlock อีก ${card.daysUntil} วัน เกินช่วง ${rule.daysBefore} วันที่ตั้งไว้` };
  }
  const when = card.timing === "continuous" ? "กำลังทยอยปลดล็อก" : card.unlockDate ? `unlock ${thaiDate(card.unlockDate)}` : "มี unlock";
  return { ok: true, reason: `เสี่ยง${level} · ${when}` };
}

/** Severity of a news item: negative news is medium; negative and serious (hack, lawsuit...) is high. */
function newsSeverity(n: NewsItem): "high" | "medium" | null {
  if (n.sentiment !== "negative") return null;
  return SERIOUS.test(`${n.summary} ${n.topics.join(" ")}`) ? "high" : "medium";
}

function resultFrom(ctx: RunContext, reply: string): AgentResult {
  return {
    requestId: ctx.requestId,
    reply,
    cards: [...ctx.cards.values()],
    news: ctx.news,
    odds: null,
    pulse: null,
    calendar: null,
    drift: ctx.drift,
    proposals: ctx.proposals,
    trace: ctx.trace,
    citations: ctx.citations,
    provider: "rules",
    model: null,
    compliance: { status: "pass", issues: [] },
    ms: 0,
    now: new Date(ctx.now).toISOString(),
  };
}

/** Check every rule of one user and send what fires to their U-Bot inbox, as one message. */
export async function runAlerts(
  userId: string,
  now: number,
  trigger: WatchSummary["trigger"] = "manual",
): Promise<{ outcomes: AlertOutcome[]; summary: WatchSummary }> {
  const rules = store.alerts.filter((r) => r.ownerId === userId);
  const typeOf = (r: AlertRule): AlertType => r.type ?? "unlock";
  const ctx = newContext({ userId, scope: "user", requestId: randomUUID(), now, locale: "th" });
  const skipped: WatchSummary["skipped"] = [];
  const outcomes = new Map<string, AlertOutcome & { rank: number }>();
  // A rule over several tokens keeps its most telling reason: fired, then a real candidate held
  // back (already sent, quiet hours, daily cap), then "nothing matched".
  const note = (r: AlertRule, fired: boolean, reason: string, rank = fired ? 3 : 1) => {
    const prev = outcomes.get(r.id);
    if (!prev || rank > prev.rank) {
      outcomes.set(r.id, {
        rank,
        ruleId: r.id,
        symbol: r.symbol,
        fired,
        reason,
        channelNote: r.channel === "ubot" ? undefined : "LINE / Telegram ยังเป็น roadmap จึงส่งเข้า U-Bot ในแอปแทน",
      });
    }
  };

  // ─── 1. Fresh data through the agent's tools ───
  const held = (await getHoldings()).map((h) => h.symbol).filter((s) => !STABLES.has(s));
  const expand = (symbol: string) => (symbol === "*" ? held : [symbol.toUpperCase()]);
  const unlockRules = rules.filter((r) => typeOf(r) === "unlock");
  const driftRules = rules.filter((r) => typeOf(r) === "drift");
  const newsRules = rules.filter((r) => typeOf(r) === "news");
  const unlockSymbols = [...new Set(unlockRules.flatMap((r) => expand(r.symbol)))];
  const newsSymbols = [...new Set(newsRules.flatMap((r) => expand(r.symbol)))].slice(0, 5);
  await Promise.all([
    ...unlockSymbols.map((symbol) => executeTool("assess_unlock_risk", { symbol, trade_amount_thb: null }, ctx)),
    driftRules.length ? executeTool("check_portfolio_drift", {}, ctx) : null,
    newsSymbols.length ? executeTool("get_market_news", { query: "", symbols: newsSymbols, days: 3 }, ctx) : null,
  ]);

  // ─── 2. Rules, in code ───
  const candidates: (Candidate & { rule: AlertRule })[] = [];
  for (const r of unlockRules) {
    for (const symbol of expand(r.symbol)) {
      const card = ctx.cards.get(symbol);
      if (!card) {
        note(r, false, ctx.notes.get(symbol) ?? `${symbol}: ไม่มีข้อมูล unlock`);
        continue;
      }
      const m = matches(r, card);
      if (!m.ok) {
        note(r, false, `${symbol}: ${m.reason}`);
        continue;
      }
      candidates.push({
        rule: r,
        ruleId: r.id,
        type: "unlock",
        symbol,
        severity: card.level === "high" ? "high" : "medium",
        dedupeKey: `unlock:${symbol}:${(card.unlockDate ?? "none").slice(0, 10)}:${card.level}`,
        title: `${symbol} ใกล้ถึงวัน unlock (เสี่ยง${LEVEL_TH[card.level]} ${card.score}/100)`,
        lines: card.reasons.slice(0, 2),
      });
    }
  }

  const drift = ctx.drift;
  for (const r of driftRules) {
    if (!drift?.hasTargets) {
      note(r, false, "ยังไม่ได้ตั้งเป้าสัดส่วนพอร์ต (ตั้งได้ที่หน้าพอร์ต)");
      continue;
    }
    const off = drift.rows.filter((row) => row.status === "over" || row.status === "under");
    if (off.length === 0) note(r, false, `ทุกเหรียญอยู่ในกรอบ ±${drift.bandPp} จุดจากเป้า`);
    for (const row of off) {
      const over = row.status === "over";
      const soon = row.unlockDate !== null && new Date(row.unlockDate).getTime() - now <= 7 * 86_400_000;
      const risky = over && row.riskLevel === "high" && soon;
      candidates.push({
        rule: r,
        ruleId: r.id,
        type: "drift",
        symbol: row.symbol,
        severity: risky ? "high" : "medium",
        // Drift may repeat once a day while it lasts.
        dedupeKey: `drift:${row.symbol}:${over ? "over" : "under"}:${bangkokDay(now)}`,
        title: `${row.symbol} ${over ? "เกิน" : "ต่ำกว่า"}เป้าที่คุณตั้ง ${Math.abs(row.driftPp ?? 0)} จุด`,
        lines: [
          `ตอนนี้ ${row.weightPct}% ของพอร์ต เป้าของคุณคือ ${row.targetPct}%`,
          ...(risky && row.unlockDate ? [`และ ${row.symbol} มี unlock เสี่ยงสูง ${untilText(row.unlockDate, now)}`] : []),
        ],
      });
    }
  }

  const news = ctx.news?.data ?? [];
  for (const r of newsRules) {
    const watched = new Set(expand(r.symbol));
    let any = false;
    for (const n of news) {
      const symbol = n.symbols.find((s) => watched.has(s));
      const severity = symbol ? newsSeverity(n) : null;
      if (!symbol || !severity || SEV[severity] < SEV[r.minLevel]) continue;
      any = true;
      // A high alert needs a second, independent source on the same token.
      const corroborated = news.some((o) => o !== n && o.source !== n.source && o.symbols.includes(symbol) && newsSeverity(o) !== null);
      if (severity === "high" && !corroborated) {
        skipped.push({ title: `ข่าว ${symbol}: ${n.summary}`, reason: `ข่าวสำคัญจากแหล่งเดียว (${n.source}) ยังไม่มีแหล่งที่สองยืนยัน` });
        note(r, false, `${symbol}: ข่าวจากแหล่งเดียว รอแหล่งที่สองยืนยัน`);
        continue;
      }
      candidates.push({
        rule: r,
        ruleId: r.id,
        type: "news",
        symbol,
        severity,
        dedupeKey: `news:${n.url}#${n.summary.slice(0, 60)}`,
        title: `ข่าว ${symbol}: ${n.summary}`,
        lines: [`ที่มา: ${n.source}${n.date ? ` · ${thaiDate(n.date)}` : ""}`],
        url: n.url,
      });
    }
    if (!any) note(r, false, "ไม่มีข่าวลบที่เกี่ยวข้องใน 3 วันที่ผ่านมา");
  }

  // ─── 3. Dedupe, quiet hours, daily cap ───
  const byKey = new Map<string, Candidate & { rule: AlertRule }>();
  for (const c of candidates) {
    const prev = byKey.get(c.dedupeKey);
    if (!prev || SEV[c.severity] > SEV[prev.severity]) byKey.set(c.dedupeKey, c);
  }
  const quiet = inQuietHours(now);
  const mine = store.alertEvents.filter((e) => e.ownerId === userId);
  let today = mine.filter((e) => bangkokDay(new Date(e.firedAt).getTime()) === bangkokDay(now)).length;
  const fired: AlertEvent[] = [];
  for (const c of [...byKey.values()].sort((a, b) => SEV[b.severity] - SEV[a.severity])) {
    const { rule, ...event } = c;
    if (mine.some((e) => e.dedupeKey === c.dedupeKey)) {
      skipped.push({ title: c.title, reason: "แจ้งไปแล้ว (กันแจ้งซ้ำ)" });
      note(rule, false, `${c.symbol}: แจ้งไปแล้ว`, 2);
    } else if (quiet && c.severity !== "high") {
      skipped.push({ title: c.title, reason: `ช่วงเวลาเงียบ ${config.watch.quietStartHour}:00–${config.watch.quietEndHour}:00 · จะแจ้งรอบถัดไป` });
      note(rule, false, `${c.symbol}: ช่วงเวลาเงียบ จะแจ้งรอบถัดไป`, 2);
    } else if (today >= config.watch.maxPerDay) {
      skipped.push({ title: c.title, reason: `ครบ ${config.watch.maxPerDay} ครั้งต่อวันแล้ว · จะแจ้งพรุ่งนี้` });
      note(rule, false, `${c.symbol}: ครบจำนวนแจ้งเตือนต่อวันแล้ว`, 2);
    } else {
      fired.push({ ...event, id: randomUUID(), ownerId: userId, firedAt: new Date(now).toISOString() });
      note(rule, true, c.title);
      today++;
    }
  }

  // ─── 4. Protective proposals + one U-Bot message ───
  if (fired.length > 0) {
    const overTarget = new Set(fired.filter((e) => e.type === "drift" && e.dedupeKey.includes(":over:")).map((e) => e.symbol));
    for (const symbol of new Set(fired.filter((e) => e.type !== "news").map((e) => e.symbol))) {
      const card = ctx.cards.get(symbol);
      if (card && (card.level === "high" || card.level === "medium")) {
        await executeTool("propose_protection", { symbol, action: overTarget.has(symbol) ? "pause_buying" : "price_alert" }, ctx);
      }
    }
    const reply = [
      `U-Guard แจ้งเตือน ${fired.length} เรื่อง`,
      ...fired.map((e) => `• ${e.title}${e.lines[0] ? ` · ${e.lines[0]}` : ""}`),
      ...(fired.some((e) => outcomes.get(e.ruleId)?.channelNote) ? ["(LINE / Telegram ยังเป็น roadmap จึงส่งผ่าน U-Bot)"] : []),
    ].join("\n");
    const base = resultFrom(ctx, reply);
    const firedSyms = new Set(fired.filter((e) => e.type !== "news").map((e) => e.symbol));
    const result: AgentResult = {
      ...base,
      cards: base.cards.filter((c) => firedSyms.has(c.symbol) && (c.level === "high" || c.level === "medium")),
      drift: fired.some((e) => e.type === "drift") ? base.drift : null,
      news: base.news ? { ...base.news, data: base.news.data.filter((n) => fired.some((e) => e.type === "news" && e.url === n.url)) } : null,
    };
    try {
      await getUBot().send(userId, "alert", result);
      store.alertEvents.unshift(...fired);
      store.alertEvents.splice(500);
    } catch (err) {
      // Not recorded, so the next run tries again.
      for (const e of fired) skipped.push({ title: e.title, reason: `ส่งไม่สำเร็จ: ${(err as Error).message}` });
      fired.length = 0;
    }
  }
  for (const r of rules) if (!outcomes.has(r.id)) note(r, false, "ไม่มีอะไรเข้าเงื่อนไข");

  const summary: WatchSummary = { ranAt: new Date(now).toISOString(), trigger, fired, skipped };
  store.lastWatch.set(userId, summary);
  return {
    outcomes: rules.map((r) => {
      const o = outcomes.get(r.id)!;
      return { ruleId: o.ruleId, symbol: o.symbol, fired: o.fired, reason: o.reason, channelNote: o.channelNote };
    }),
    summary,
  };
}
