// Portfolio drift (AGENTIC-WORKFLOW.md §8): how far the wallet has moved from the target mix
// the user set, together with unlock risk, dilution and concentration. Deterministic, and
// measured against the user's own plan: it never says what to buy or sell.

import { readFixture } from "./fixtures";
import { supplyForecast } from "./forecast";
import { LEVEL_TH, untilText } from "./format";
import { getHoldings } from "./portfolio";
import { assessUnlockRisk } from "./risk";
import { store, type Targets } from "./store";
import type { DriftReport, DriftRow, Locale, RiskLevel } from "./types";

const LEVEL_EN: Record<RiskLevel, string> = { high: "high", medium: "medium", low: "low", none: "no" };

export async function getTargets(userId: string): Promise<Targets> {
  const mine = store.targets.get(userId);
  if (mine) return mine;
  const fx = await readFixture<Targets>("targets.json");
  return { targets: { ...(fx?.targets ?? {}) }, bandPp: fx?.bandPp ?? 5 };
}

export function setTargets(userId: string, t: Targets): void {
  store.targets.set(userId, t);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export async function checkDrift(userId: string, opts: { now?: number; locale?: Locale } = {}): Promise<DriftReport> {
  const th = opts.locale !== "en";
  const [holdings, t] = await Promise.all([getHoldings(), getTargets(userId)]);
  const totalThb = holdings.reduce((s, h) => s + h.valueThb, 0);
  const hasTargets = Object.keys(t.targets).length > 0;
  // Out of band: more than the band in points, or more than a quarter off a small target.
  const outOfBand = (drift: number, target: number) =>
    Math.abs(drift) > t.bandPp || (target > 0 && Math.abs(drift) >= 1 && Math.abs(drift) / target > 0.25);

  const rows: DriftRow[] = await Promise.all(
    holdings.map(async (h) => {
      const [risk, forecast] = await Promise.all([assessUnlockRisk(h.symbol, null, { now: opts.now }), supplyForecast(h.symbol, 6)]);
      const card = risk.ok ? risk.card : null;
      const weightPct = totalThb > 0 ? (h.valueThb / totalThb) * 100 : 0;
      const target = hasTargets ? (t.targets[h.symbol] ?? 0) : null;
      const drift = target === null ? null : weightPct - target;
      return {
        symbol: h.symbol,
        valueThb: Math.round(h.valueThb),
        weightPct: r1(weightPct),
        targetPct: target,
        driftPp: drift === null ? null : r1(drift),
        status: drift === null || target === null ? "no_target" : !outOfBand(drift, target) ? "ok" : drift > 0 ? "over" : "under",
        riskLevel: card?.level ?? null,
        riskScore: card && card.level !== "none" ? card.score : 0,
        unlockDate: card?.unlockDate ?? null,
        dilutionPct: r1(forecast?.dilutionPct ?? 0),
      } satisfies DriftRow;
    }),
  );
  // Targets for tokens the user doesn't hold count as fully under target.
  for (const [symbol, target] of Object.entries(t.targets)) {
    if (target <= 0 || rows.some((r) => r.symbol === symbol)) continue;
    rows.push({ symbol, valueThb: 0, weightPct: 0, targetPct: target, driftPp: -target, status: outOfBand(-target, target) ? "under" : "ok", riskLevel: null, riskScore: 0, unlockDate: null, dilutionPct: 0 });
  }

  const withTarget = rows.filter((r) => r.driftPp !== null);
  const totalDriftPct = r1(withTarget.reduce((s, r) => s + Math.abs(r.driftPp!), 0) / 2);
  const portfolioRiskScore = Math.round(rows.reduce((s, r) => s + (r.weightPct / 100) * r.riskScore, 0));
  const weightedDilutionPct = r1(rows.reduce((s, r) => s + (r.weightPct / 100) * r.dilutionPct, 0));
  const top = [...rows].sort((a, b) => b.weightPct - a.weightPct)[0];

  const out = withTarget.filter((r) => r.status === "over" || r.status === "under").sort((a, b) => Math.abs(b.driftPp!) - Math.abs(a.driftPp!));
  const describe = (r: DriftRow) =>
    th
      ? `${r.symbol} อยู่ที่ ${r.weightPct}% ของพอร์ต ${r.status === "over" ? "เกิน" : "ต่ำกว่า"}เป้าที่คุณตั้งไว้ (${r.targetPct}%) ${Math.abs(r.driftPp!)} จุด`
      : `${r.symbol} is ${r.weightPct}% of the portfolio, ${Math.abs(r.driftPp!)} points ${r.status === "over" ? "above" : "below"} your ${r.targetPct}% target`;
  const lines: string[] = [];
  if (!hasTargets) {
    lines.push(th ? "ยังไม่ได้ตั้งเป้าสัดส่วนพอร์ต จึงดูได้แค่การกระจุกตัวและความเสี่ยง" : "No target mix set yet, so only concentration and risk are shown.");
    if (top) lines.push(th ? `เหรียญที่ถือมากที่สุดคือ ${top.symbol} (${top.weightPct}% ของพอร์ต)` : `Largest holding: ${top.symbol} (${top.weightPct}% of the portfolio).`);
  } else if (out.length === 0) {
    lines.push(th ? `ทุกเหรียญอยู่ในกรอบ ±${t.bandPp} จุดจากเป้าที่คุณตั้งไว้` : `Every holding is within ±${t.bandPp} points of your targets.`);
  } else {
    lines.push(describe(out[0]));
    const riskyOver = out.find((r) => r.status === "over" && (r.riskLevel === "high" || r.riskLevel === "medium") && r.unlockDate);
    if (riskyOver?.unlockDate) {
      lines.push(
        th
          ? `ส่วนที่เกินเป้าคือเหรียญที่มี unlock ${LEVEL_TH[riskyOver.riskLevel!]} (${riskyOver.symbol}, ${untilText(riskyOver.unlockDate, opts.now)})`
          : `The overweight part has a ${LEVEL_EN[riskyOver.riskLevel!]}-risk unlock coming (${riskyOver.symbol}, ${riskyOver.unlockDate.slice(0, 10)}).`,
      );
    } else if (out[1]) {
      lines.push(describe(out[1]));
    }
  }
  lines.push(
    th
      ? `คะแนนความเสี่ยง unlock ทั้งพอร์ต ${portfolioRiskScore}/100${hasTargets ? ` · ห่างจากเป้ารวม ${totalDriftPct}%` : ""}`
      : `Portfolio unlock risk ${portfolioRiskScore}/100${hasTargets ? ` · ${totalDriftPct}% of the portfolio is off target` : ""}.`,
  );

  const asOfs = holdings.map((h) => h.asOf).filter((x): x is string => Boolean(x)).sort();
  return {
    hasTargets,
    bandPp: t.bandPp,
    rows,
    totalThb: Math.round(totalThb),
    totalDriftPct,
    portfolioRiskScore,
    weightedDilutionPct,
    concentration: top ? { symbol: top.symbol, weightPct: top.weightPct } : null,
    lines: lines.slice(0, 3),
    pricesAsOf: asOfs[0] ?? null,
  };
}
