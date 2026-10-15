// Deterministic unlock-risk score. The LLM explains this result; it never computes it.
//
// Weights follow Keyrock's study of 16,000+ unlock events
// (https://keyrock.com/from-locked-to-liquidity-what-16000-token-unlocks-teach-us/):
//   - 90% of unlocks push price down; pressure starts ~30 days before, sharpest in the last week
//   - size relative to circulating supply matters (buckets below are Keyrock's)
//   - recipient matters most: team unlocks are worst (~-25%), investor unlocks are
//     hedged/OTC (moderate), ecosystem-development unlocks average +1.18%

import { config } from "./config";
import { compact, daysBetween, pct, thaiDate, untilText, usd } from "./format";
import { getQuote } from "./market";
import { findToken, getFundraising, getUnlockEvents, type AllocationUnlock, type FundraisingData } from "./tokenomist";
import type { DataSource, RecipientClass, RecipientSlice, RiskCard, RiskLevel } from "./types";

const RECIPIENT_WEIGHT: Record<RecipientClass, number> = {
  team: 1.0,
  investor: 0.6,
  community: 0.5,
  other: 0.5,
  reserve: 0.4,
  ecosystem: 0.0,
};

export const RECIPIENT_TH: Record<RecipientClass, string> = {
  team: "ทีมงาน",
  investor: "นักลงทุน",
  community: "ชุมชน / airdrop",
  other: "อื่นๆ",
  reserve: "เงินสำรองโครงการ",
  ecosystem: "กองทุนพัฒนา ecosystem",
};

export function classifyRecipient(allocationName: string, standardName: string): RecipientClass {
  const name = allocationName.toLowerCase();
  if (/ecosystem|grant|liquidity|development fund|incentive/.test(name)) return "ecosystem";
  const std = standardName.toLowerCase();
  if (std.includes("team") || std.includes("founder")) return "team";
  if (std.includes("investor")) return "investor";
  if (std.includes("community")) return "community";
  if (std.includes("reserve")) return "reserve";
  return "other";
}

function sizeScore(pctCirc: number): number {
  if (pctCirc < 0.1) return 0.05; // nano
  if (pctCirc < 0.5) return 0.2; // micro
  if (pctCirc < 1) return 0.4; // small
  if (pctCirc < 5) return 0.7; // medium
  if (pctCirc < 10) return 1.0; // large
  return 0.9; // huge: Keyrock found these no worse than large (too big to dump at once)
}

function liquidityScore(daysOfVolume: number | null): number {
  if (daysOfVolume === null) return 0.5;
  if (daysOfVolume < 0.1) return 0.1;
  if (daysOfVolume < 0.5) return 0.4;
  if (daysOfVolume < 1) return 0.7;
  return 1.0;
}

function timeFactor(days: number): number {
  if (days <= 7) return 1.0;
  if (days <= 14) return 0.8;
  return 0.65;
}

function levelFor(score: number): RiskLevel {
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}

/** Current price ÷ the price the most recent priced round paid. */
function investorMultiple(
  fund: FundraisingData | null,
  priceUsd: number,
  maxSupply: number,
): { multiple: number; round: string } | null {
  const rounds = [...(fund?.fundingRounds ?? [])].sort((a, b) => b.fundingDate.localeCompare(a.fundingDate));
  for (const r of rounds) {
    if (r.pricePerToken && r.pricePerToken > 0) return { multiple: priceUsd / r.pricePerToken, round: r.fundingRound };
    if (r.valuation && r.valuation > 0 && maxSupply > 0) {
      return { multiple: (priceUsd * maxSupply) / r.valuation, round: r.fundingRound };
    }
  }
  return null;
}

function multipleScore(m: number | null): number {
  if (m === null) return 0;
  if (m >= 10) return 1;
  if (m >= 3) return 0.6;
  if (m >= 1) return 0.3;
  return 0; // investors under water rarely rush to sell
}

export type RiskResult = { ok: true; card: RiskCard } | { ok: false; reason: string };

export async function assessUnlockRisk(symbol: string, tradeAmountThb: number | null = null): Promise<RiskResult> {
  const { token } = await findToken(symbol);
  if (!token) {
    return {
      ok: false,
      reason: `${symbol.toUpperCase()} ไม่มีตาราง unlock ใน Tokenomist (เช่น stablecoin หรือเหรียญที่ไม่มี vesting) จึงไม่มีความเสี่ยงจาก unlock`,
    };
  }

  const now = Date.now();
  const start = new Date(now).toISOString().slice(0, 10);
  const end = new Date(now + config.watchWindowDays * 86_400_000).toISOString().slice(0, 10);
  const [events, fundraising, quote] = await Promise.all([
    getUnlockEvents(token.id, start, end),
    getFundraising(token.id),
    getQuote(token.symbol),
  ]);

  const priceUsd = quote?.priceUsd ?? (token.circulatingSupply > 0 ? token.marketCap / token.circulatingSupply : 0);
  const sourceMode: DataSource = events.source;
  const base = {
    symbol: token.symbol,
    name: token.name,
    tradeAmountThb: tradeAmountThb ?? undefined,
    source: { provider: "Tokenomist" as const, mode: sourceMode, asOf: events.asOf },
  };

  const next = events.data
    .filter((e) => (e.cliffUnlocks?.cliffAmount ?? 0) > 0)
    .sort((a, b) => a.unlockDate.localeCompare(b.unlockDate))[0];

  if (!next?.cliffUnlocks) {
    return {
      ok: true,
      card: {
        ...base,
        level: "none",
        score: 0,
        unlockDate: null,
        daysUntil: null,
        amount: 0,
        valueUsd: 0,
        pctOfCirculating: 0,
        daysOfVolume: null,
        breakdown: [],
        investorMultiple: null,
        reasons: [`ไม่มี unlock ของ ${token.symbol} ในอีก ${config.watchWindowDays} วันข้างหน้า`],
        factors: { time: 0, size: 0, liquidity: 0, recipient: 0, investorBonus: 0 },
      },
    };
  }

  const cliff = next.cliffUnlocks;
  const amount = cliff.cliffAmount;
  const valueUsd = amount * priceUsd;
  const pctCirc = token.circulatingSupply > 0 ? (amount / token.circulatingSupply) * 100 : 0;
  const daysOfVolume = quote && quote.volume24hUsd > 0 ? valueUsd / quote.volume24hUsd : null;
  const daysUntil = Math.max(0, daysBetween(now, next.unlockDate));

  const breakdown: RecipientSlice[] = cliff.allocationBreakdown.map((a: AllocationUnlock) => ({
    name: a.allocationName,
    recipient: classifyRecipient(a.allocationName, a.standardAllocationName),
    amount: a.cliffAmount,
    valueUsd: a.cliffAmount * priceUsd,
    share: amount > 0 ? a.cliffAmount / amount : 0,
  }));
  breakdown.sort((a, b) => b.share - a.share);

  const recipient = breakdown.reduce((sum, s) => sum + s.share * RECIPIENT_WEIGHT[s.recipient], 0);
  const investorShare = breakdown.filter((s) => s.recipient === "investor").reduce((sum, s) => sum + s.share, 0);
  const mult = investorMultiple(fundraising.data, priceUsd, token.maxSupply);
  const investorBonus = 10 * investorShare * multipleScore(mult?.multiple ?? null);

  const factors = {
    time: timeFactor(daysUntil),
    size: sizeScore(pctCirc),
    liquidity: liquidityScore(daysOfVolume),
    recipient,
    investorBonus,
  };
  const score = Math.min(
    100,
    Math.round(100 * factors.time * (0.35 * factors.size + 0.3 * factors.liquidity + 0.35 * factors.recipient) + investorBonus),
  );
  const level = levelFor(score);

  // ─── Plain-Thai reasons (deterministic, so numbers are never hallucinated) ───
  const reasons: string[] = [
    `${untilText(next.unlockDate, now)} (${thaiDate(next.unlockDate)}) จะปลดล็อก ${compact(amount)} ${token.symbol} (~${usd(valueUsd)}) = ${pct(pctCirc)} ของเหรียญที่หมุนเวียน`,
  ];
  if (daysOfVolume !== null) {
    const feel = daysOfVolume >= 0.5 ? "ตลาดอาจรับแรงขายได้ยาก" : daysOfVolume < 0.1 ? "ตลาดรับได้สบาย" : "ตลาดพอรับได้";
    reasons.push(`มูลค่าเท่ากับ ~${daysOfVolume.toFixed(2)} วันของ volume ซื้อขาย (${feel})`);
  }
  const top = breakdown[0];
  if (top) {
    const share = Math.round(top.share * 100);
    const note: Record<RecipientClass, string> = {
      team: "Keyrock พบว่า unlock ของทีมกดราคาแรงที่สุด (เฉลี่ย −25%)",
      investor: "นักลงทุนมักทยอยขายผ่าน OTC/hedge ผลกระทบปานกลาง",
      community: "ผลกระทบมักปานกลาง",
      other: "",
      reserve: "ขึ้นกับว่าโครงการนำไปใช้อย่างไร",
      ecosystem: "Keyrock พบว่ามักไม่กดราคา (เฉลี่ย +1.18%)",
    };
    reasons.push(`ผู้รับหลักคือ${RECIPIENT_TH[top.recipient]} (${share}%)${note[top.recipient] ? ` · ${note[top.recipient]}` : ""}`);
  }
  if (mult && investorShare > 0) {
    reasons.push(`นักลงทุนรอบ ${mult.round} ได้ราคาถูกกว่าตอนนี้ ~${mult.multiple.toFixed(1)} เท่า`);
  } else if (daysUntil <= 7) {
    reasons.push("เข้าสู่ 7 วันสุดท้ายก่อน unlock ซึ่งเป็นช่วงที่ราคามักแกว่งแรงที่สุด");
  }

  return {
    ok: true,
    card: {
      ...base,
      level,
      score,
      unlockDate: next.unlockDate,
      daysUntil,
      amount,
      valueUsd,
      pctOfCirculating: pctCirc,
      daysOfVolume,
      breakdown,
      investorMultiple: mult?.multiple ?? null,
      reasons,
      factors,
      tradeAmountThb: tradeAmountThb ?? undefined,
    },
  };
}
