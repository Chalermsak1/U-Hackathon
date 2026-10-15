// Deterministic fallback agent: no LLM, same tools, same Agent Trace. Used when there is
// no API key, the network is down, or AGENT_MODE=offline. Keeps the stage demo alive.

import { LEVEL_TH } from "../format";
import { freshLabelTh, isStale, mergeFresh } from "../freshness";
import { listTokens } from "../tokenomist";
import type { AgentResult, ChatTurn, RiskCard } from "../types";
import { executeTool, newContext, resultFromContext, type RunContext } from "./tools";

const ALIASES: Record<string, string> = {
  อาร์บิทรัม: "ARB",
  อาร์บ: "ARB",
  เวิลด์คอยน์: "WLD",
  เวิลด์: "WLD",
  อวาแลนช์: "AVAX",
  อาวาแลนช์: "AVAX",
  เอแวกซ์: "AVAX",
  ยูเอสดีซี: "USDC",
  บิตคอยน์: "BTC",
  อีเธอเรียม: "ETH",
};
const EXTRA_TICKERS = ["USDC", "USDT", "BTC", "ETH"];
const STABLES = ["USDC", "USDT"];

async function findSymbols(text: string): Promise<string[]> {
  const upper = text.toUpperCase();
  const tickers = [...(await listTokens()).data.map((t) => t.symbol.toUpperCase()), ...EXTRA_TICKERS];
  const found = new Set<string>();
  for (const t of tickers) if (new RegExp(`(^|[^A-Z])${t}([^A-Z]|$)`).test(upper)) found.add(t);
  for (const [alias, t] of Object.entries(ALIASES)) if (text.includes(alias)) found.add(t);
  return [...found];
}

function parseThb(text: string): number | null {
  const m = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(บาท|฿|thb)/i);
  return m ? Number(m[1]) : null;
}

function line(card: RiskCard): string {
  if (card.level === "none") return `${card.symbol}: ${card.reasons[0]}`;
  return `${card.symbol}: ${LEVEL_TH[card.level]} (${card.score}/100) · ${card.reasons[0]}`;
}

async function holdingSymbols(ctx: RunContext): Promise<string[]> {
  const res = JSON.parse((await executeTool("get_portfolio", {}, ctx)).content) as { holdings?: { symbol: string }[] };
  return (res.holdings ?? []).map((h) => h.symbol);
}

async function assess(symbol: string, thb: number | null, ctx: RunContext, action: "pause_buying" | "price_alert"): Promise<string> {
  const res = JSON.parse((await executeTool("assess_unlock_risk", { symbol, trade_amount_thb: thb }, ctx)).content);
  if (res.tracked === false) return res.note as string;
  const card = ctx.cards.get(res.symbol)!;
  if (card.level === "high" || card.level === "medium") {
    await executeTool("propose_protection", { symbol: card.symbol, action }, ctx);
  }
  return line(card);
}

async function news(symbols: string[], ctx: RunContext): Promise<string[]> {
  if (symbols.length === 0) return [];
  await executeTool("search_news", { symbols: symbols.slice(0, 5), days: 7, query: null }, ctx);
  const items = [...ctx.news.values()];
  if (items.length === 0) return [`ไม่พบข่าวสำคัญของ ${symbols.join(", ")} ในช่วง 7 วันที่ผ่านมา`];
  return items.slice(0, 3).map((n) => `ข่าว ${n.symbols.join("/")}: ${n.gistTh} (ตาม ${n.publisher})`);
}

/** "ข้อมูล ณ ..." line plus a warning when any source is stale (AGENTIC-WORKFLOW.md §6). */
function freshnessLines(ctx: RunContext): string[] {
  const fresh = mergeFresh(ctx.fresh);
  if (fresh.length === 0) return [];
  const out = [`ข้อมูล: ${fresh.map((f) => freshLabelTh(f)).join(" · ")}`];
  const stale = fresh.filter((f) => isStale(f));
  if (stale.length > 0) out.push(`ข้อมูลจาก ${stale.map((f) => f.provider).join(", ")} อาจไม่ล่าสุด (ดึงข้อมูลสดไม่สำเร็จ)`);
  return out;
}

export async function runOfflineAgent(message: string, _history: ChatTurn[]): Promise<AgentResult> {
  const ctx = newContext();
  const text = message.trim();
  const wantsScan = /สแกน|scan|ถืออะไร|ถืออยู่/i.test(text);
  const wantsDrift = /เป้า|คลาดเคลื่อน|drift|สัดส่วน|กระจุก|สมดุล|rebalance|พอร์ต|portfolio/i.test(text);
  const wantsNews = /ข่าว|news|เกิดอะไร|ทำไมราคา|มีอะไรใหม่/i.test(text);
  const wantsToBuy = /ซื้อ|buy|dca|เข้า/i.test(text);
  const lines: string[] = [];

  if (wantsScan || wantsDrift) {
    const symbols = (await holdingSymbols(ctx)).filter((s) => !STABLES.includes(s));
    if (wantsDrift) {
      await executeTool("check_portfolio_drift", {}, ctx);
      lines.push(...(ctx.drift?.lines.slice(0, 2) ?? []));
    }
    const over = new Set(ctx.drift?.rows.filter((r) => r.status === "over").map((r) => r.symbol) ?? []);
    const risk = await Promise.all(symbols.map((s) => assess(s, null, ctx, over.has(s) ? "pause_buying" : "price_alert")));
    if (wantsScan || !wantsDrift) lines.push(...risk, "USDC: stablecoin ไม่มีความเสี่ยงจาก unlock");
    if (wantsNews) lines.push(...(await news(symbols, ctx)));
  } else {
    const symbols = await findSymbols(text);
    if (symbols.length === 0) {
      if (wantsNews) {
        lines.push(...(await news((await holdingSymbols(ctx)).filter((s) => !STABLES.includes(s)), ctx)));
      } else {
        return resultFromContext(
          ctx,
          'บอกชื่อเหรียญที่อยากเช็กได้เลย เช่น "ซื้อ ARB 5,000 บาท", "สแกนพอร์ตของฉัน", "พอร์ตห่างจากเป้าไหม" หรือ "มีข่าวอะไรกระทบ ARB ไหม"',
          "offline",
        );
      }
    } else if (wantsNews) {
      lines.push(...(await news(symbols, ctx)));
    } else {
      await executeTool("lookup_token", { symbol: symbols[0] }, ctx);
      const thb = parseThb(text);
      lines.push(...(await Promise.all(symbols.map((s) => assess(s, thb, ctx, wantsToBuy ? "pause_buying" : "price_alert")))));
    }
  }

  if (ctx.proposals.length > 0) lines.push("มีข้อเสนอให้ตั้งการป้องกันในการ์ดด้านล่าง คุณเป็นคนตัดสินใจเอง");
  lines.push(...freshnessLines(ctx));
  return resultFromContext(ctx, lines.join("\n"), "offline");
}
