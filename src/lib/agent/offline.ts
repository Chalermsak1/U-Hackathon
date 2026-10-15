// Deterministic fallback agent: no LLM, same tools, same Agent Trace. Used when there is
// no API key, the network is down, or AGENT_MODE=offline. Keeps the stage demo alive.

import { LEVEL_TH } from "../format";
import { listTokens } from "../tokenomist";
import type { AgentResult, ChatTurn, RiskCard } from "../types";
import { executeTool, newContext, type RunContext } from "./tools";

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

async function assess(symbol: string, thb: number | null, ctx: RunContext, wantsToBuy: boolean): Promise<string> {
  const res = JSON.parse((await executeTool("assess_unlock_risk", { symbol, trade_amount_thb: thb }, ctx)).content);
  if (res.tracked === false) return res.note as string;
  const card = ctx.cards.get(res.symbol)!;
  if (card.level === "high" || card.level === "medium") {
    await executeTool("propose_protection", { symbol: card.symbol, action: wantsToBuy ? "pause_buying" : "price_alert" }, ctx);
  }
  return line(card);
}

export async function runOfflineAgent(message: string, _history: ChatTurn[]): Promise<AgentResult> {
  const ctx = newContext();
  const text = message.trim();
  const wantsScan = /สแกน|scan|พอร์ต|portfolio|ถืออะไร|ถืออยู่/i.test(text);
  const wantsToBuy = /ซื้อ|buy|dca|เข้า/i.test(text);
  const lines: string[] = [];

  if (wantsScan) {
    const holdings = JSON.parse((await executeTool("get_portfolio", {}, ctx)).content) as { symbol: string }[];
    const symbols = holdings.map((h) => h.symbol).filter((s) => !["USDC", "USDT"].includes(s));
    lines.push(...(await Promise.all(symbols.map((s) => assess(s, null, ctx, false)))));
    lines.push("USDC: stablecoin ไม่มีความเสี่ยงจาก unlock");
  } else {
    const symbols = await findSymbols(text);
    if (symbols.length === 0) {
      return {
        reply: 'บอกชื่อเหรียญที่อยากเช็กได้เลย เช่น "ซื้อ ARB 5,000 บาท" หรือ "สแกนพอร์ตของฉัน"',
        cards: [],
        proposals: [],
        trace: ctx.trace,
        mode: "offline",
      };
    }
    await executeTool("lookup_token", { symbol: symbols[0] }, ctx);
    const thb = parseThb(text);
    lines.push(...(await Promise.all(symbols.map((s) => assess(s, thb, ctx, wantsToBuy)))));
  }

  if (ctx.proposals.length > 0) lines.push("มีข้อเสนอให้ตั้งการป้องกันในการ์ดด้านล่าง คุณเป็นคนตัดสินใจเอง");
  if ([...ctx.cards.values()].some((c) => c.source.mode === "sample")) lines.push("(ข้อมูลตัวอย่าง)");

  return {
    reply: lines.join("\n"),
    cards: [...ctx.cards.values()],
    proposals: ctx.proposals,
    trace: ctx.trace,
    mode: "offline",
  };
}
