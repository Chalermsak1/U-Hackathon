// Trade plans and paper orders. The user picks the token, side and amount; U-Guard drafts the
// plan around that choice (size, stop-loss, what-if rows) and runs its checks. Every number
// here is arithmetic on the user's inputs, the quote and the wallet, or a dated historical
// average: no model picks tokens or predicts prices. The user approves; the order is a paper
// order whose approval is recorded on Avalanche Fuji (simulated without a key).

import { randomUUID } from "node:crypto";
import { runAgent } from "./agent";
import { recordMemo } from "./avalanche";
import { engineLabel, LEVEL_TH, thb } from "./format";
import { getMarketPulse } from "./intel/pulse";
import { getQuote, usdToThb } from "./market";
import { getHoldings } from "./portfolio";
import { assessUnlockRisk } from "./risk";
import { store } from "./store";
import { findToken } from "./tokenomist";
import type { PaperOrder, TradeCheck, TradePlan, TradeScenario, TradeSide } from "./types";

/** Assumed exchange fee, shown in the UI as an assumption. */
export const FEE_RATE = 0.0025;
const STABLES = new Set(["USDC", "USDT", "DAI"]);
const NAMES: Record<string, string> = { USDC: "USD Coin", USDT: "Tether", BTC: "Bitcoin", ETH: "Ethereum" };
const CONCENTRATION_PCT = 25;
const CHASE_PCT = 10;
const TEAM_UNLOCK_AVG_PCT = -25; // Keyrock, 16,000+ unlock events (see risk.ts)

export interface PlanInput {
  symbol: string;
  side: TradeSide;
  amountThb: number;
  orderType: "market" | "limit";
  limitPriceUsd?: number | null;
  stopLossPct?: number;
  riskBudgetPct?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const usdPrice = (p: number) => `$${p.toLocaleString("en-US", { maximumFractionDigits: p < 1 ? 4 : 2 })}`;
const qtyText = (q: number) => q.toLocaleString("en-US", { maximumFractionDigits: q < 1 ? 6 : q < 100 ? 4 : 2 });
const pct1 = (v: number) => `${v.toFixed(v < 1 ? 2 : 1)}%`;

/** Wallet plus approved paper orders: cash (USDC) and each token's quantity. */
export async function paperWallet(userId: string) {
  const [holdings, fx] = await Promise.all([getHoldings(), usdToThb()]);
  const qty = new Map(holdings.map((h) => [h.symbol, h.amount]));
  const price = new Map(holdings.map((h) => [h.symbol, h.priceUsd]));
  for (const o of store.orders.get(userId) ?? []) {
    const sign = o.side === "buy" ? 1 : -1;
    qty.set(o.symbol, (qty.get(o.symbol) ?? 0) + sign * o.qty);
    // Paper orders settle against USDC at the order's own fill.
    const usdc = (o.side === "buy" ? -(o.amountThb + o.feeThb) : o.amountThb - o.feeThb) / fx;
    qty.set("USDC", (qty.get("USDC") ?? 0) + usdc);
    if (!price.has(o.symbol)) price.set(o.symbol, (await getQuote(o.symbol))?.priceUsd ?? o.priceUsd);
  }
  const valueThb = (s: string) => (qty.get(s) ?? 0) * (price.get(s) ?? 0) * fx;
  const totalThb = [...qty.keys()].reduce((sum, s) => sum + valueThb(s), 0);
  return { qty, price, fx, valueThb, totalThb };
}

export async function draftTradePlan(input: PlanInput, userId: string, now: number): Promise<TradePlan | { error: string }> {
  const sym = input.symbol.trim().toUpperCase();
  const quote = await getQuote(sym);
  if (!quote) return { error: `ยังไม่มีราคา ${sym} ใน demo นี้` };
  const [{ token }, wallet, risk, pulse] = await Promise.all([
    findToken(sym),
    paperWallet(userId),
    assessUnlockRisk(sym, input.amountThb, { now, locale: "th" }),
    getMarketPulse(),
  ]);
  const fx = wallet.fx;
  const side = input.side;
  const amountThb = Math.round(input.amountThb);
  const stopLossPct = clamp(input.stopLossPct ?? 10, 2, 50);
  const riskBudgetPct = clamp(input.riskBudgetPct ?? 2, 0.5, 10);
  const limit = input.orderType === "limit" && input.limitPriceUsd && input.limitPriceUsd > 0 ? input.limitPriceUsd : null;
  const priceUsd = limit ?? quote.priceUsd;
  const feeThb = Math.round(amountThb * FEE_RATE);
  const qty = side === "buy" ? (amountThb - feeThb) / (priceUsd * fx) : amountThb / (priceUsd * fx);
  const stopPriceUsd = priceUsd * (1 - stopLossPct / 100);
  const maxLossThb = side === "buy" ? Math.round(amountThb * (stopLossPct / 100) + feeThb) : 0;
  const portfolioThb = wallet.totalThb;
  const maxSizeThb = Math.round((portfolioThb * riskBudgetPct) / stopLossPct);
  const positionThb = wallet.valueThb(sym);
  const positionAfter = side === "buy" ? positionThb + amountThb : Math.max(0, positionThb - amountThb);
  const positionPctAfter = portfolioThb > 0 ? (positionAfter / portfolioThb) * 100 : 0;
  const card = risk.ok ? risk.card : null;

  // ─── U-Guard checks ───
  const checks: TradeCheck[] = [];
  if (card && (card.level === "high" || card.level === "medium")) {
    checks.push({
      id: "unlock",
      status: side === "buy" ? "warn" : "ok",
      label: `มี unlock ใกล้ · ${LEVEL_TH[card.level]} ${card.score}/100`,
      detail: card.reasons[0] ?? card.headline,
    });
  } else {
    checks.push({
      id: "unlock",
      status: "ok",
      label: "ไม่มี unlock ก้อนใหญ่ใน 30 วัน",
      detail: card ? card.reasons[0] ?? card.headline : risk.ok ? "" : risk.reason,
    });
  }
  if (STABLES.has(sym)) {
    checks.push({ id: "stablecoin", status: "ok", label: "เป็น stablecoin", detail: "ราคาผูกกับดอลลาร์ จุดตัดขาดทุนแทบไม่มีผล" });
  }
  if (side === "buy") {
    const cashThb = wallet.valueThb("USDC");
    checks.push(
      amountThb + feeThb > cashThb
        ? { id: "balance", status: "block", label: "ยอด USDC ไม่พอ", detail: `มี USDC ประมาณ ${thb(cashThb)} แต่แผนนี้ใช้ ${thb(amountThb + feeThb)}` }
        : { id: "balance", status: "ok", label: "ยอด USDC พอ", detail: `ใช้ ${thb(amountThb + feeThb)} จาก ${thb(cashThb)}` },
    );
    const lossPct = portfolioThb > 0 ? (maxLossThb / portfolioThb) * 100 : 0;
    checks.push(
      amountThb > maxSizeThb
        ? {
            id: "size",
            status: "warn",
            label: "ขนาดไม้เกินงบความเสี่ยง",
            detail: `ถ้าลงถึงจุดตัดขาดทุน −${stopLossPct}% จะเสีย ~${thb(maxLossThb)} = ${pct1(lossPct)} ของพอร์ต (งบ ${riskBudgetPct}%) · ขนาดที่อยู่ในงบคือไม่เกิน ${thb(maxSizeThb)}`,
          }
        : {
            id: "size",
            status: "ok",
            label: "ขนาดไม้อยู่ในงบความเสี่ยง",
            detail: `ถ้าลงถึงจุดตัดขาดทุน −${stopLossPct}% เสียสูงสุด ~${thb(maxLossThb)} = ${pct1(lossPct)} ของพอร์ต (งบ ${riskBudgetPct}%)`,
          },
    );
    if (!STABLES.has(sym)) {
      checks.push(
        positionPctAfter > CONCENTRATION_PCT
          ? { id: "concentration", status: "warn", label: `พอร์ตจะกระจุกที่ ${sym}`, detail: `หลังซื้อ ${sym} จะเป็น ${pct1(positionPctAfter)} ของพอร์ต (เกิน ${CONCENTRATION_PCT}%)` }
          : { id: "concentration", status: "ok", label: "การกระจายพอร์ตยังโอเค", detail: `หลังซื้อ ${sym} จะเป็น ${pct1(positionPctAfter)} ของพอร์ต` },
      );
    }
    if (quote.change24hPct !== null && quote.change24hPct > CHASE_PCT) {
      checks.push({ id: "chase", status: "warn", label: "ราคาเพิ่งขึ้นแรง", detail: `ขึ้นมาแล้ว ${quote.change24hPct.toFixed(1)}% ใน 24 ชม. ระวังซื้อตามราคา (FOMO)` });
    }
  } else {
    const held = wallet.qty.get(sym) ?? 0;
    checks.push(
      qty > held + 1e-9
        ? { id: "balance", status: "block", label: `${sym} ในกระเป๋าไม่พอ`, detail: `ถืออยู่ ${qtyText(held)} ${sym} แต่แผนนี้ขาย ${qtyText(qty)}` }
        : { id: "balance", status: "ok", label: `${sym} พอขาย`, detail: `ขาย ${qtyText(qty)} จาก ${qtyText(held)} ${sym}` },
    );
  }
  const verdict = checks.some((c) => c.status === "block") ? "blocked" : checks.some((c) => c.status === "warn") ? "caution" : "ready";

  // ─── What-if rows (arithmetic on the plan, or a cited historical average) ───
  const row = (label: string, pct: number, basis: string): TradeScenario => {
    const move = side === "buy" ? (amountThb - feeThb) * (pct / 100) - feeThb : -amountThb * (pct / 100); // sell: what you avoid or miss
    return { label, pct, priceUsd: priceUsd * (1 + pct / 100), pnlThb: Math.round(move), basis };
  };
  const scenarios: TradeScenario[] =
    side === "buy"
      ? [
          row("ถึงจุดตัดขาดทุน", -stopLossPct, "จุดที่คุณตั้งไว้"),
          row("ถึงเป้า 1:2", stopLossPct * 2, "เป้าที่ได้ 2 เท่าของความเสี่ยงที่รับ · เป็นการคำนวณ ไม่ใช่การทายราคา"),
        ]
      : [
          row("ถ้าราคาลงหลังขาย", -stopLossPct, "มูลค่าที่เลี่ยงได้ถ้าราคาลงเท่าจุดตัดขาดทุน"),
          row("ถ้าราคาขึ้นหลังขาย", stopLossPct * 2, "กำไรที่จะพลาดถ้าราคาขึ้น 2 เท่าของจุดตัดขาดทุน"),
        ];
  const teamShare = card?.breakdown.filter((b) => b.recipient === "team").reduce((s, b) => s + b.share, 0) ?? 0;
  if (card && teamShare >= 0.3 && (card.timing === "upcoming" || card.timing === "recent")) {
    scenarios.push(row("ถ้าเป็นแบบ unlock ทีมในอดีต", TEAM_UNLOCK_AVG_PCT, "ค่าเฉลี่ยราคาช่วง unlock ของทีม (Keyrock, 16,000+ เหตุการณ์) · ถ้าตั้งจุดตัดขาดทุนไว้ จะขายก่อนถึงจุดนี้"));
  }
  const im = pulse.data.impliedMove;
  if (im) {
    scenarios.push(row(`ตลาด options คาด (BTC ${im.days} วัน) ขาลง`, -im.pct, `ช่วง ±${im.pct.toFixed(1)}% ที่ตลาด options ให้โอกาสราว 68% · altcoin มักผันผวนกว่า BTC`));
  }

  const summary = [
    `${side === "buy" ? "ซื้อ" : "ขาย"} ${sym} ${thb(amountThb)} ≈ ${qtyText(qty)} ${sym} ที่ ${usdPrice(priceUsd)}${limit ? " (limit)" : ""}`,
    side === "buy"
      ? `จุดตัดขาดทุน −${stopLossPct}% ที่ ${usdPrice(stopPriceUsd)} → เสียสูงสุด ~${thb(maxLossThb)}`
      : `ได้เงินประมาณ ${thb(amountThb - feeThb)} หลังค่าธรรมเนียม · เหลือ ${qtyText(Math.max(0, (wallet.qty.get(sym) ?? 0) - qty))} ${sym}`,
    verdict === "blocked"
      ? `ทำตามแผนนี้ไม่ได้: ${checks.find((c) => c.status === "block")!.detail}`
      : verdict === "caution"
        ? `U-Guard ขอให้ดู ${checks.filter((c) => c.status === "warn").length} เรื่องก่อนอนุมัติ: ${checks.filter((c) => c.status === "warn").map((c) => c.label).join(" · ")}`
        : "ผ่านการตรวจของ U-Guard ทุกข้อ · คุณเป็นคนตัดสินใจ",
  ];

  // The agent explains in its own words (Claude when configured; rules engine otherwise).
  let agent: TradePlan["agent"] = null;
  try {
    const message = side === "buy" ? `ซื้อ ${sym} ${amountThb.toLocaleString("en-US")} บาท` : `เช็ก ${sym} ให้หน่อย`;
    const res = await runAgent({ message, userId, scope: "user", now, route: "/api/trade/plan", locale: "th" });
    agent = { reply: res.reply, engine: engineLabel(res), trace: res.trace };
  } catch {
    agent = null;
  }

  const plan: TradePlan = {
    id: randomUUID(),
    symbol: sym,
    name: token?.name ?? NAMES[sym] ?? sym,
    side,
    orderType: limit ? "limit" : "market",
    amountThb,
    priceUsd,
    quotePriceUsd: quote.priceUsd,
    usdThb: fx,
    qty,
    feeThb,
    stopLossPct,
    stopPriceUsd,
    maxLossThb,
    riskBudgetPct,
    maxSizeThb,
    portfolioThb: Math.round(portfolioThb),
    positionPctAfter,
    checks,
    scenarios,
    verdict,
    summary,
    card,
    agent,
    priceSource: quote.source,
    priceAsOf: quote.asOf,
    priceStale: quote.stale ?? false,
    createdAt: new Date(now).toISOString(),
    status: "pending",
  };
  store.tradePlans.set(plan.id, { plan, ownerId: userId });
  if (store.tradePlans.size > 500) store.tradePlans.delete(store.tradePlans.keys().next().value!);
  return plan;
}

export type DecideResult =
  | { ok: true; plan: TradePlan; order: PaperOrder | null }
  | { ok: false; status: number; error: string; plan?: TradePlan };

export async function decideTradePlan(planId: string, decision: "approve" | "decline", userId: string): Promise<DecideResult> {
  const rec = store.tradePlans.get(planId);
  if (!rec || rec.ownerId !== userId) return { ok: false, status: 404, error: "ไม่พบแผนนี้ ลองให้ AI ร่างใหม่" };
  const { plan } = rec;
  const orderFor = () => (store.orders.get(userId) ?? []).find((o) => o.planId === plan.id) ?? null;
  if (plan.status !== "pending") {
    const same = (plan.status === "approved") === (decision === "approve");
    return same ? { ok: true, plan, order: orderFor() } : { ok: false, status: 409, error: `แผนนี้${plan.status === "approved" ? "อนุมัติ" : "ยกเลิก"}ไปแล้ว`, plan };
  }
  if (decision === "decline") {
    plan.status = "declined";
    return { ok: true, plan, order: null };
  }
  if (plan.verdict === "blocked") return { ok: false, status: 409, error: "แผนนี้ทำไม่ได้ตามที่ U-Guard ตรวจ ปรับแผนก่อน", plan };
  const memo = JSON.stringify({
    app: "U-Guard",
    v: 1,
    kind: "paper_trade",
    symbol: plan.symbol,
    side: plan.side,
    qty: Number(plan.qty.toFixed(6)),
    priceUsd: plan.priceUsd,
    stopUsd: Number(plan.stopPriceUsd.toFixed(6)),
    checks: plan.checks.filter((c) => c.status !== "ok").map((c) => c.id),
    approvedAt: new Date().toISOString(),
  });
  const receipt = await recordMemo(plan.id, memo);
  const order: PaperOrder = {
    id: randomUUID(),
    planId: plan.id,
    symbol: plan.symbol,
    side: plan.side,
    qty: plan.qty,
    priceUsd: plan.priceUsd,
    amountThb: plan.amountThb,
    feeThb: plan.feeThb,
    stopPriceUsd: plan.stopPriceUsd,
    at: new Date().toISOString(),
    receipt,
  };
  plan.status = "approved";
  const list = store.orders.get(userId) ?? [];
  list.push(order);
  store.orders.set(userId, list.slice(-200));
  return { ok: true, plan, order };
}

/** Paper orders plus net positions (qty, average cost, value now, unrealised P/L). */
export async function tradingSummary(userId: string) {
  const orders = store.orders.get(userId) ?? [];
  const fx = await usdToThb();
  const bySym = new Map<string, { qty: number; cost: number }>();
  for (const o of orders) {
    const p = bySym.get(o.symbol) ?? { qty: 0, cost: 0 };
    if (o.side === "buy") {
      p.qty += o.qty;
      p.cost += o.amountThb;
    } else {
      const avg = p.qty > 0 ? p.cost / p.qty : 0;
      p.qty -= o.qty;
      p.cost -= avg * o.qty;
    }
    bySym.set(o.symbol, p);
  }
  const positions = await Promise.all(
    [...bySym.entries()]
      .filter(([, p]) => p.qty > 1e-9)
      .map(async ([symbol, p]) => {
        const price = (await getQuote(symbol))?.priceUsd ?? 0;
        const valueThb = p.qty * price * fx;
        return { symbol, qty: p.qty, costThb: Math.round(p.cost), valueThb: Math.round(valueThb), pnlThb: Math.round(valueThb - p.cost), priceUsd: price };
      }),
  );
  const pending = [...store.tradePlans.values()].filter((r) => r.ownerId === userId && r.plan.status === "pending").map((r) => r.plan).slice(-5);
  return { orders: [...orders].reverse(), positions, pending };
}
