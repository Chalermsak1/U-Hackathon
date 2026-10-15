// Portfolio drift (AGENTIC-WORKFLOW.md §8): how far the portfolio has moved from the mix
// the user set, plus its unlock risk, dilution and concentration. All deterministic.
// Drift compares against the user's own plan; it never says what to buy or sell.

import { readFixture } from "./fixtures";
import { supplyForecast } from "./forecast";
import { LEVEL_TH, untilText } from "./format";
import { mergeFresh } from "./freshness";
import { getHoldings } from "./portfolio";
import { assessUnlockRisk } from "./risk";
import { store, type Targets } from "./store";
import type { DriftReport, DriftRow, Holding, RiskCard } from "./types";

export interface HoldingRisk extends Holding {
  weightPct: number;
  card: RiskCard | null;
  dilutionPct: number;
}

export async function getTargets(): Promise<Targets> {
  if (!store.targets) {
    const fx = await readFixture<Targets>("targets.json");
    store.targets = { targets: fx?.targets ?? {}, bandPp: fx?.bandPp ?? 5 };
  }
  return store.targets;
}

export function setTargets(t: Targets): void {
  store.targets = t;
}

/** Every holding with its weight, unlock risk card and 6-month dilution. */
export async function portfolioRisk(): Promise<{ rows: HoldingRisk[]; totalThb: number }> {
  const holdings = await getHoldings();
  const totalThb = holdings.reduce((s, h) => s + h.valueThb, 0);
  const rows = await Promise.all(
    holdings.map(async (h): Promise<HoldingRisk> => {
      const [risk, forecast] = await Promise.all([assessUnlockRisk(h.symbol), supplyForecast(h.symbol, 6)]);
      return {
        ...h,
        weightPct: totalThb > 0 ? (h.valueThb / totalThb) * 100 : 0,
        card: risk.ok ? risk.card : null,
        dilutionPct: forecast?.dilutionPct ?? 0,
      };
    }),
  );
  return { rows, totalThb };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export async function checkDrift(pre?: { rows: HoldingRisk[]; totalThb: number }): Promise<DriftReport> {
  const [{ rows, totalThb }, t] = await Promise.all([pre ?? portfolioRisk(), getTargets()]);
  const hasTargets = Object.keys(t.targets).length > 0;

  const outOfBand = (drift: number, target: number) =>
    Math.abs(drift) > t.bandPp || (target > 0 && Math.abs(drift) >= 1 && Math.abs(drift) / target > 0.25);

  const driftRows: DriftRow[] = rows.map((r) => {
    const target = hasTargets ? (t.targets[r.symbol] ?? null) : null;
    const drift = target === null ? null : r.weightPct - target;
    const status: DriftRow["status"] =
      drift === null || target === null ? "no_target" : !outOfBand(drift, target) ? "ok" : drift > 0 ? "over" : "under";
    return {
      symbol: r.symbol,
      valueThb: r.valueThb,
      weightPct: r1(r.weightPct),
      targetPct: target,
      driftPp: drift === null ? null : r1(drift),
      status,
      riskLevel: r.card?.level ?? null,
      riskScore: r.card && r.card.level !== "none" ? r.card.score : 0,
      unlockDate: r.card?.unlockDate ?? null,
      dilutionPct: r1(r.dilutionPct),
    };
  });
  // Targets for tokens the user doesn't hold yet count as fully under target.
  for (const [symbol, target] of Object.entries(t.targets)) {
    if (driftRows.some((r) => r.symbol === symbol)) continue;
    driftRows.push({
      symbol,
      valueThb: 0,
      weightPct: 0,
      targetPct: target,
      driftPp: -target,
      status: outOfBand(-target, target) ? "under" : "ok",
      riskLevel: null,
      riskScore: 0,
      unlockDate: null,
      dilutionPct: 0,
    });
  }

  const withTarget = driftRows.filter((r) => r.driftPp !== null);
  const totalDriftPct = r1(withTarget.reduce((s, r) => s + Math.abs(r.driftPp!), 0) / 2);
  const portfolioRiskScore = Math.round(driftRows.reduce((s, r) => s + (r.weightPct / 100) * r.riskScore, 0));
  const weightedDilutionPct = r1(driftRows.reduce((s, r) => s + (r.weightPct / 100) * r.dilutionPct, 0));
  const top = [...driftRows].sort((a, b) => b.weightPct - a.weightPct)[0];
  const hhi = Math.round(driftRows.reduce((s, r) => s + (r.weightPct / 100) ** 2, 0) * 100) / 100;

  // ─── Plain-Thai lines (at most 3) ───
  const lines: string[] = [];
  const out = withTarget.filter((r) => r.status === "over" || r.status === "under").sort((a, b) => Math.abs(b.driftPp!) - Math.abs(a.driftPp!));
  const describe = (r: DriftRow) =>
    `${r.symbol} อยู่ที่ ${r.weightPct}% ของพอร์ต ${r.status === "over" ? "เกิน" : "ต่ำกว่า"}เป้าที่คุณตั้งไว้ (${r.targetPct}%) ${Math.abs(r.driftPp!)} จุด`;
  if (!hasTargets) {
    lines.push("ยังไม่ได้ตั้งเป้าสัดส่วนพอร์ต จึงดูได้แค่การกระจุกตัวและความเสี่ยง");
    if (top) lines.push(`เหรียญที่ถือมากที่สุดคือ ${top.symbol} (${top.weightPct}% ของพอร์ต)`);
  } else if (out.length === 0) {
    lines.push(`ทุกเหรียญอยู่ในกรอบ ±${t.bandPp} จุดจากเป้าที่คุณตั้งไว้`);
  } else {
    lines.push(describe(out[0]));
    const riskyOver = out.find((r) => r.status === "over" && (r.riskLevel === "high" || r.riskLevel === "medium"));
    if (riskyOver && riskyOver.unlockDate) {
      lines.push(
        `ส่วนที่เกินเป้าคือเหรียญที่มี unlock ${LEVEL_TH[riskyOver.riskLevel!]} (${riskyOver.symbol}, ${untilText(riskyOver.unlockDate)})`,
      );
    } else if (out[1]) {
      lines.push(describe(out[1]));
    }
  }
  lines.push(
    `คะแนนความเสี่ยง unlock ทั้งพอร์ต ${portfolioRiskScore}/100${hasTargets ? ` · ห่างจากเป้ารวม ${totalDriftPct}%` : ""}`,
  );

  return {
    hasTargets,
    bandPp: t.bandPp,
    rows: driftRows,
    totalThb,
    totalDriftPct,
    portfolioRiskScore,
    weightedDilutionPct,
    concentration: top ? { symbol: top.symbol, weightPct: top.weightPct, hhi } : null,
    lines: lines.slice(0, 3),
    fresh: mergeFresh([...rows.flatMap((r) => r.fresh), ...rows.flatMap((r) => r.card?.fresh ?? [])]),
  };
}
