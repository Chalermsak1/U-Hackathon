// Invest plans: a five-question risk profile picks a model portfolio (the user can change every
// weight), U-Guard checks the crypto part against unlock schedules, and the monthly DCA dates
// are flagged when they land on a big unlock. Model portfolios are illustrative and labelled
// as such; a real advisory service needs a licensed partner (Thai SEC).

import { randomUUID } from "node:crypto";
import { recordMemo } from "./avalanche";
import { readFixture } from "./fixtures";
import { thaiDate, thb } from "./format";
import { assessUnlockRisk } from "./risk";
import { store } from "./store";
import type { DataSource, InvestCheck, InvestPlan, InvestProfile, InvestSlice } from "./types";

interface Universe {
  mode?: DataSource;
  classes: { id: string; th: string; example: string; risk: number; feePct: number; color: string }[];
  profiles: Record<InvestProfile, { th: string; weights: Record<string, number>; cryptoMax: number }>;
}

export const QUESTIONS = [
  { q: "ตั้งใจลงทุนนานแค่ไหน", a: ["ไม่ถึง 1 ปี", "1–3 ปี", "3–5 ปี", "มากกว่า 5 ปี"] },
  { q: "ถ้าพอร์ตลดลง 20% ในเดือนเดียว คุณจะ", a: ["ขายทั้งหมด", "ขายบางส่วน", "ถือต่อ", "ซื้อเพิ่ม"] },
  { q: "เคยลงทุนอะไรมาแล้ว", a: ["ยังไม่เคย", "เงินฝาก / กองทุนตลาดเงิน", "หุ้น / กองทุนหุ้น", "คริปโต / อนุพันธ์"] },
  { q: "เงินที่จะลงทุนคิดเป็นเท่าไรของเงินออมทั้งหมด", a: ["มากกว่า 75%", "50–75%", "25–50%", "น้อยกว่า 25%"] },
  { q: "เป้าหมายหลัก", a: ["รักษาเงินต้น", "รายได้สม่ำเสมอ", "เติบโตปานกลาง", "เติบโตสูง"] },
] as const;

export interface InvestInput {
  answers: number[]; // five answers, 1..4
  lumpSumThb: number;
  monthlyThb: number;
  dcaDay: number;
  weights?: Record<string, number>; // user-adjusted, any scale; normalised to 100
  cryptoPicks?: string[];
}

export function profileFor(score: number): InvestProfile {
  if (score <= 9) return "conservative";
  if (score <= 14) return "moderate";
  if (score <= 17) return "growth";
  return "aggressive";
}

async function universe(): Promise<Universe> {
  const u = await readFixture<Universe>("invest-universe.json");
  if (!u) throw new Error("invest-universe.json missing");
  return u;
}

/** Profile defaults, for the page to show before the user drafts a plan. */
export async function investDefaults() {
  const u = await universe();
  return { questions: QUESTIONS, classes: u.classes, profiles: u.profiles, source: u.mode ?? "sample" };
}

function nextDcaDates(now: number, day: number, n: number): string[] {
  const d = new Date(now);
  const out: string[] = [];
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  if (d.getUTCDate() >= day) m += 1;
  while (out.length < n) {
    const dt = new Date(Date.UTC(y, m, day));
    out.push(dt.toISOString().slice(0, 10));
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

const DAY = 86_400_000;

export async function draftInvestPlan(input: InvestInput, userId: string, now: number): Promise<InvestPlan> {
  const u = await universe();
  const score = input.answers.reduce((s, a) => s + a, 0);
  const profile = profileFor(score);
  const base = u.profiles[profile];

  // Weights: the user's own when given, else the profile's model portfolio. Normalised to 100.
  const raw = Object.fromEntries(u.classes.map((c) => [c.id, Math.max(0, input.weights?.[c.id] ?? base.weights[c.id] ?? 0)]));
  const total = Object.values(raw).reduce((s, v) => s + v, 0) || 1;
  const slices: InvestSlice[] = u.classes.map((c) => {
    const pct = Math.round((raw[c.id] / total) * 1000) / 10;
    return {
      id: c.id,
      th: c.th,
      example: c.example,
      risk: c.risk,
      pct,
      lumpThb: Math.round((input.lumpSumThb * pct) / 100),
      monthlyThb: Math.round((input.monthlyThb * pct) / 100),
      color: c.color,
    };
  });
  const cryptoPct = slices.find((s) => s.id === "crypto")?.pct ?? 0;
  const weightedRisk = slices.reduce((s, x) => s + (x.pct / 100) * Math.min(8, x.risk), 0);
  const feePctYear = slices.reduce((s, x) => s + (x.pct / 100) * (u.classes.find((c) => c.id === x.id)?.feePct ?? 0), 0);

  // Crypto split and U-Guard's unlock check on each pick.
  const picks = [...new Set((input.cryptoPicks?.length ? input.cryptoPicks : ["BTC", "ETH"]).map((p) => p.toUpperCase()))].slice(0, 5);
  const crypto: InvestPlan["crypto"] = [];
  const unlocks: { symbol: string; date: string; th: string }[] = [];
  for (const sym of picks) {
    const r = await assessUnlockRisk(sym, null, { now, locale: "th" });
    if (r.ok) {
      const c = r.card;
      crypto.push({ symbol: sym, pctOfCrypto: Math.round(1000 / picks.length) / 10, level: c.level, score: c.score, note: c.reasons[0] ?? c.headline });
      for (const d of [c.unlockDate, c.nextUnlock?.date]) {
        if (d && c.timing !== "continuous") unlocks.push({ symbol: sym, date: d, th: thaiDate(d) });
      }
    } else {
      crypto.push({ symbol: sym, pctOfCrypto: Math.round(1000 / picks.length) / 10, level: "none", score: null, note: r.reason });
    }
  }

  const dates = nextDcaDates(now, Math.min(28, Math.max(1, Math.round(input.dcaDay))), 3);
  const dca = dates.map((date) => {
    const t = new Date(`${date}T00:00:00Z`).getTime();
    const notes = unlocks
      .filter((x) => {
        const gap = (new Date(x.date).getTime() - t) / DAY;
        return gap >= -2 && gap <= 7;
      })
      .map((x) => `${x.symbol}: งวดนี้อยู่ในช่วง unlock ${x.th} · เลื่อนงวด ${x.symbol} ไปหลัง unlock ได้ถ้าต้องการ`);
    return { date, amountThb: input.monthlyThb, notes };
  });

  const checks: InvestCheck[] = [];
  checks.push(
    cryptoPct > base.cryptoMax
      ? { status: "warn", label: `คริปโต ${cryptoPct}% สูงกว่าระดับ "${base.th}"`, detail: `แบบประเมินของคุณอยู่ระดับ${base.th} ซึ่งพอร์ตตัวอย่างมีคริปโตไม่เกิน ${base.cryptoMax}%` }
      : { status: "ok", label: `คริปโต ${cryptoPct}% อยู่ในระดับ "${base.th}"`, detail: `พอร์ตตัวอย่างระดับนี้มีคริปโตไม่เกิน ${base.cryptoMax}%` },
  );
  for (const c of crypto.filter((x) => x.level === "high" || x.level === "medium")) {
    checks.push({ status: "warn", label: `${c.symbol} มี unlock ใกล้ (เสี่ยง${c.level === "high" ? "สูง" : "ปานกลาง"} ${c.score}/100)`, detail: c.note });
  }
  const flagged = dca.filter((d) => d.notes.length > 0).length;
  if (cryptoPct > 0) {
    checks.push(
      flagged > 0
        ? { status: "warn", label: `DCA ${flagged} งวดตรงกับช่วง unlock`, detail: "ดูวันที่ที่มีหมายเหตุในตาราง DCA ด้านล่าง" }
        : { status: "ok", label: "DCA ไม่ตรงกับ unlock ใหญ่", detail: "3 งวดข้างหน้าไม่อยู่ในช่วง 7 วันก่อน unlock ของเหรียญที่เลือก" },
    );
  }
  if (input.answers[3] === 1) {
    checks.push({ status: "warn", label: "ลงทุนเกิน 75% ของเงินออม", detail: "ควรกันเงินสำรองฉุกเฉิน (ราว 3–6 เดือนของรายจ่าย) ไว้นอกพอร์ตก่อน" });
  }
  const riskyPct = slices.filter((s) => ["thai_equity", "global_equity", "gold", "crypto"].includes(s.id)).reduce((s, x) => s + x.pct, 0);
  if (input.answers[0] === 1 && riskyPct > 30) {
    checks.push({ status: "warn", label: "ระยะเวลาสั้นแต่สินทรัพย์เสี่ยงเยอะ", detail: `ลงทุนไม่ถึง 1 ปี แต่หุ้น/ทอง/คริปโตรวม ${riskyPct.toFixed(0)}% ราคาอาจยังไม่ฟื้นทันเวลาที่ต้องใช้เงิน` });
  }

  const top = [...slices].sort((a, b) => b.pct - a.pct).slice(0, 3);
  const warns = checks.filter((c) => c.status === "warn");
  const summary = [
    `แบบประเมิน ${score}/20 → ระดับ "${base.th}" · พอร์ตตัวอย่างเน้น ${top.map((t) => `${t.th} ${t.pct}%`).join(", ")}`,
    `เงินก้อน ${thb(input.lumpSumThb)} + DCA ${thb(input.monthlyThb)} ทุกวันที่ ${dates[0].slice(8, 10).replace(/^0/, "")} · ความเสี่ยงเฉลี่ย ${weightedRisk.toFixed(1)}/8 · ค่าธรรมเนียมราว ${feePctYear.toFixed(2)}%/ปี`,
    warns.length ? `U-Guard ขอให้ดู ${warns.length} เรื่อง: ${warns.map((w) => w.label).join(" · ")}` : "ผ่านการตรวจของ U-Guard ทุกข้อ · คุณปรับสัดส่วนเองได้ก่อนอนุมัติ",
  ];

  const plan: InvestPlan = {
    id: randomUUID(),
    profile,
    profileTh: base.th,
    score,
    lumpSumThb: input.lumpSumThb,
    monthlyThb: input.monthlyThb,
    dcaDay: Math.round(input.dcaDay),
    slices,
    crypto,
    checks,
    dca,
    weightedRisk,
    feePctYear,
    summary,
    source: u.mode ?? "sample",
    createdAt: new Date(now).toISOString(),
    status: "pending",
  };
  store.investPlans.set(plan.id, { plan, ownerId: userId });
  if (store.investPlans.size > 500) store.investPlans.delete(store.investPlans.keys().next().value!);
  return plan;
}

export async function decideInvestPlan(planId: string, decision: "approve" | "decline", userId: string) {
  const rec = store.investPlans.get(planId);
  if (!rec || rec.ownerId !== userId) return { ok: false as const, status: 404, error: "ไม่พบแผนนี้ ลองร่างใหม่" };
  const { plan } = rec;
  if (plan.status !== "pending") {
    const same = (plan.status === "approved") === (decision === "approve");
    return same ? { ok: true as const, plan } : { ok: false as const, status: 409, error: "แผนนี้ตัดสินใจไปแล้ว" };
  }
  if (decision === "decline") {
    plan.status = "declined";
    return { ok: true as const, plan };
  }
  plan.receipt = await recordMemo(
    plan.id,
    JSON.stringify({
      app: "U-Guard",
      v: 1,
      kind: "invest_plan",
      profile: plan.profile,
      weights: Object.fromEntries(plan.slices.map((s) => [s.id, s.pct])),
      monthlyThb: plan.monthlyThb,
      dcaDay: plan.dcaDay,
      approvedAt: new Date().toISOString(),
    }),
  );
  plan.status = "approved";
  return { ok: true as const, plan };
}

export function myInvestPlans(userId: string): InvestPlan[] {
  return [...store.investPlans.values()].filter((r) => r.ownerId === userId && r.plan.status === "approved").map((r) => r.plan).reverse();
}
