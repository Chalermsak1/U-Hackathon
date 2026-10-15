// Alert engine v0 (AGENTIC-WORKFLOW.md §9). Runs on a schedule (Vercel Cron) or from the
// "ตรวจตอนนี้" button:
//   1. fetch fresh data through the agent's own tools (same trace and freshness as a chat)
//   2. evaluate every rule in code; no model decides whether to alert
//   3. dedupe, cooldown, quiet hours, daily cap
//   4. send one U-Bot message with the fired alerts, cards and protective proposals
// Messages are composed deterministically, so they can't drift into advice.

import { executeTool, newContext, resultFromContext } from "./agent/tools";
import { config } from "./config";
import { LEVEL_TH, untilText } from "./format";
import { freshLabelTh, isStale, mergeFresh } from "./freshness";
import { writeLog } from "./log";
import { TRUSTED_PUBLISHERS } from "./news";
import { ensureDefaultRules, store, type AlertEvent, type AlertRule, type WatchSummary } from "./store";
import type { AgentResult, RiskLevel } from "./types";
import { getUBot } from "./ubot";

const STABLES = new Set(["USDC", "USDT", "DAI"]);
const LEVEL_RANK: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };
const SEV_RANK = { low: 1, medium: 2, high: 3 } as const;
const DAY_MS = 86_400_000;
// unlock and news alerts fire once per key; drift may repeat once a day while it lasts.
const COOLDOWN_MS: Record<AlertRule["type"], number> = { unlock: Infinity, drift: DAY_MS, news: Infinity };

type Candidate = Omit<AlertEvent, "id" | "firedAt">;

const bangkokDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

function inQuietHours(now: Date): boolean {
  const h = Number(now.toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Bangkok" }));
  const { quietStartHour: start, quietEndHour: end } = config.watch;
  return start > end ? h >= start || h < end : h >= start && h < end;
}

function alreadySent(c: Candidate, nowMs: number): boolean {
  const cooldown = COOLDOWN_MS[c.type];
  return store.alertEvents.some(
    (e) => e.dedupeKey === c.dedupeKey && (cooldown === Infinity || nowMs - new Date(e.firedAt).getTime() < cooldown),
  );
}

export async function runWatch(trigger: "cron" | "manual"): Promise<WatchSummary> {
  const t0 = Date.now();
  const now = new Date();
  const rules = ensureDefaultRules();
  const ctx = newContext();
  const candidates: Candidate[] = [];
  const skipped: WatchSummary["skipped"] = [];

  // ─── 1. Fresh data ───
  const portfolio = JSON.parse((await executeTool("get_portfolio", {}, ctx)).content) as { holdings?: { symbol: string }[] };
  const held = (portfolio.holdings ?? []).map((h) => h.symbol).filter((s) => !STABLES.has(s));
  const expand = (symbol: string) => (symbol === "*" ? held : [symbol.toUpperCase()]);

  const unlockRules = rules.filter((r): r is Extract<AlertRule, { type: "unlock" }> => r.type === "unlock");
  const driftRules = rules.filter((r): r is Extract<AlertRule, { type: "drift" }> => r.type === "drift");
  const newsRules = rules.filter((r): r is Extract<AlertRule, { type: "news" }> => r.type === "news");

  const unlockSymbols = [...new Set(unlockRules.flatMap((r) => expand(r.symbol)))];
  const newsSymbols = [...new Set(newsRules.flatMap((r) => expand(r.symbol)))].slice(0, 5);
  await Promise.all([
    ...unlockSymbols.map((symbol) => executeTool("assess_unlock_risk", { symbol, trade_amount_thb: null }, ctx)),
    driftRules.length ? executeTool("check_portfolio_drift", {}, ctx) : null,
    newsSymbols.length ? executeTool("search_news", { symbols: newsSymbols, days: 3, query: null }, ctx) : null,
  ]);

  // ─── 2. Rules, in code ───
  for (const r of unlockRules) {
    for (const symbol of expand(r.symbol)) {
      const card = ctx.cards.get(symbol);
      if (!card?.unlockDate || card.daysUntil === null) continue;
      if (LEVEL_RANK[card.level] < LEVEL_RANK[r.minLevel] || card.daysUntil > r.daysBefore) continue;
      candidates.push({
        ruleId: r.id,
        type: "unlock",
        symbol,
        severity: card.level === "high" ? "high" : "medium",
        dedupeKey: `unlock:${symbol}:${card.unlockDate.slice(0, 10)}:${card.level}`,
        title: `${symbol} ใกล้ถึงวัน unlock (${LEVEL_TH[card.level]} ${card.score}/100)`,
        lines: card.reasons.slice(0, 2),
        channel: r.channel,
      });
    }
  }

  const drift = ctx.drift;
  if (drift?.hasTargets) {
    for (const r of driftRules) {
      for (const row of drift.rows) {
        if (row.driftPp === null || Math.abs(row.driftPp) <= r.bandPp) continue;
        const over = row.driftPp > 0;
        const soon = row.unlockDate !== null && new Date(row.unlockDate).getTime() - now.getTime() <= 7 * DAY_MS;
        const risky = over && row.riskLevel === "high" && soon;
        candidates.push({
          ruleId: r.id,
          type: "drift",
          symbol: row.symbol,
          severity: risky ? "high" : "medium",
          dedupeKey: `drift:${row.symbol}:${over ? "over" : "under"}`,
          title: `${row.symbol} ${over ? "เกิน" : "ต่ำกว่า"}เป้าที่คุณตั้ง ${Math.abs(row.driftPp)} จุด`,
          lines: [
            `ตอนนี้ ${row.weightPct}% ของพอร์ต เป้าของคุณคือ ${row.targetPct}%`,
            ...(risky && row.unlockDate ? [`และ ${row.symbol} มี unlock เสี่ยงสูง ${untilText(row.unlockDate)}`] : []),
          ],
          channel: r.channel,
        });
      }
    }
  }

  const news = [...ctx.news.values()];
  for (const r of newsRules) {
    const watched = new Set(expand(r.symbol));
    for (const n of news) {
      const symbol = n.symbols.find((s) => watched.has(s));
      if (!symbol || SEV_RANK[n.severity] < SEV_RANK[r.minSeverity]) continue;
      const key = `news:${n.url}#${n.title.slice(0, 60)}`;
      // A high alert needs a trusted publisher or a second, independent source.
      const corroborated = news.some(
        (o) => o !== n && o.publisher !== n.publisher && o.eventType === n.eventType && o.symbols.some((s) => n.symbols.includes(s)),
      );
      if (n.severity === "high" && !TRUSTED_PUBLISHERS.has(n.publisher) && !corroborated) {
        skipped.push({ key, title: n.title, reason: `ข่าวสำคัญจากแหล่งเดียว (${n.publisher}) ยังไม่มีแหล่งที่สองยืนยัน` });
        continue;
      }
      candidates.push({
        ruleId: r.id,
        type: "news",
        symbol,
        severity: n.severity,
        dedupeKey: key,
        title: `ข่าว ${symbol}: ${n.title}`,
        lines: [n.gistTh, `ที่มา: ${n.publisher}`],
        channel: r.channel,
        url: n.url,
      });
    }
  }

  // ─── 3. Dedupe, cooldown, quiet hours, daily cap ───
  const byKey = new Map<string, Candidate>();
  for (const c of candidates) {
    const prev = byKey.get(c.dedupeKey);
    if (!prev || SEV_RANK[c.severity] > SEV_RANK[prev.severity]) byKey.set(c.dedupeKey, c);
  }
  const ordered = [...byKey.values()].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);
  const quiet = inQuietHours(now);
  let today = store.alertEvents.filter((e) => bangkokDay(new Date(e.firedAt)) === bangkokDay(now)).length;
  const fired: AlertEvent[] = [];
  for (const c of ordered) {
    if (alreadySent(c, now.getTime())) {
      skipped.push({ key: c.dedupeKey, title: c.title, reason: "แจ้งไปแล้ว (กันแจ้งซ้ำ)" });
    } else if (quiet && c.severity !== "high") {
      skipped.push({ key: c.dedupeKey, title: c.title, reason: "ช่วงเวลาเงียบ 22:00–07:00 · จะแจ้งรอบถัดไป" });
    } else if (today >= config.watch.maxPerDay) {
      skipped.push({ key: c.dedupeKey, title: c.title, reason: `ครบ ${config.watch.maxPerDay} ครั้งต่อวันแล้ว · จะแจ้งรอบถัดไป` });
    } else {
      fired.push({ ...c, id: crypto.randomUUID(), firedAt: now.toISOString() });
      today++;
    }
  }

  // ─── 4. Protective proposals + one U-Bot message ───
  let result: AgentResult | null = null;
  if (fired.length > 0) {
    const overTarget = new Set(fired.filter((e) => e.dedupeKey === `drift:${e.symbol}:over`).map((e) => e.symbol));
    for (const symbol of new Set(fired.filter((e) => e.type !== "news").map((e) => e.symbol))) {
      if (!ctx.cards.has(symbol)) continue; // propose_protection needs the risk card (low/none are refused)
      await executeTool("propose_protection", { symbol, action: overTarget.has(symbol) ? "pause_buying" : "price_alert" }, ctx);
    }
    const fresh = mergeFresh(ctx.fresh);
    const stale = fresh.filter((f) => isStale(f)).map((f) => f.provider);
    const reply = [
      `U-Guard แจ้งเตือน ${fired.length} เรื่อง`,
      ...fired.map((e) => `• ${e.title} · ${e.lines[0]}`),
      ...(stale.length ? [`ข้อมูลจาก ${stale.join(", ")} อาจไม่ล่าสุด`] : []),
      ...(fired.some((e) => e.channel !== "ubot") ? ["(Telegram / LINE ยังเป็น roadmap จึงส่งผ่าน U-Bot)"] : []),
      `ข้อมูล: ${fresh.map((f) => freshLabelTh(f)).join(" · ")}`,
    ].join("\n");
    const base = resultFromContext(ctx, reply, "watch");
    const unlockSymbolsFired = new Set(fired.filter((e) => e.type === "unlock" || e.type === "drift").map((e) => e.symbol));
    result = {
      ...base,
      cards: base.cards.filter((c) => unlockSymbolsFired.has(c.symbol) && c.level !== "low" && c.level !== "none"),
      drift: fired.some((e) => e.type === "drift") ? base.drift : null,
      news: (base.news ?? []).filter((n) => fired.some((e) => e.type === "news" && e.url === n.url)),
    };
    try {
      await getUBot().send(config.watch.userId, "alert", result);
      store.alertEvents.unshift(...fired);
      store.alertEvents.splice(200);
    } catch (err) {
      // Not recorded, so the next run tries again.
      for (const e of fired) skipped.push({ key: e.dedupeKey, title: e.title, reason: `ส่งไม่สำเร็จ: ${(err as Error).message}` });
      fired.length = 0;
      result = null;
    }
  }

  const summary: WatchSummary = {
    ranAt: now.toISOString(),
    trigger,
    ms: Date.now() - t0,
    rules: rules.length,
    checked: [...new Set([...unlockSymbols, ...newsSymbols, ...(driftRules.length ? held : [])])],
    fired,
    skipped,
    result,
  };
  store.lastWatch = summary;
  await writeLog({
    type: "watch",
    trigger,
    ms: summary.ms,
    fired: fired.map((e) => e.dedupeKey),
    skipped: skipped.map((s) => ({ key: s.key, reason: s.reason })),
  });
  return summary;
}
