// The agent's tools. Both the Claude agent and the offline fallback run tools through
// executeTool(), so the Agent Trace on screen looks the same in either mode.

import type Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { compact, thaiDate, usd } from "../format";
import { getQuote } from "../market";
import { getHoldings } from "../portfolio";
import { assessUnlockRisk } from "../risk";
import { store } from "../store";
import { findToken, getAllocations, getFundraising, getUnlockEvents } from "../tokenomist";
import type { Proposal, ProtectionAction, RiskCard, TraceStep } from "../types";

const symbolProp = { type: "string", description: "Token ticker, e.g. SUI, WLD, AVAX" } as const;

export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_portfolio",
    description:
      "List the user's holdings in their U-topia wallet (symbol, amount, value in THB). Call this first when the user asks about their portfolio or what they hold.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "lookup_token",
    description:
      "Tokenomist overview of one token: price, market cap, FDV, share of max supply already circulating, latest fundraising round.",
    strict: true,
    input_schema: { type: "object", properties: { symbol: symbolProp }, required: ["symbol"], additionalProperties: false },
  },
  {
    name: "get_unlock_schedule",
    description: "Upcoming token unlock events for one token within the next N days, with who receives the tokens.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { symbol: symbolProp, days: { type: "integer", description: "Look-ahead window in days (1-90)" } },
      required: ["symbol", "days"],
      additionalProperties: false,
    },
  },
  {
    name: "get_allocations",
    description: "How a token's total supply is split (team, investors, community...) and how much of each is still locked.",
    strict: true,
    input_schema: { type: "object", properties: { symbol: symbolProp }, required: ["symbol"], additionalProperties: false },
  },
  {
    name: "get_fundraising",
    description: "A token's venture funding rounds: date, amount raised, valuation, price per token.",
    strict: true,
    input_schema: { type: "object", properties: { symbol: symbolProp }, required: ["symbol"], additionalProperties: false },
  },
  {
    name: "assess_unlock_risk",
    description:
      "Compute the unlock risk score (0-100) and level for one token over the next 30 days, using size vs circulating supply, size vs daily volume, recipient type and investor profit multiple. The score is authoritative: report it, never recompute it. The app shows the result to the user as a risk card.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        symbol: symbolProp,
        trade_amount_thb: {
          anyOf: [{ type: "number" }, { type: "null" }],
          description: "THB amount the user intends to buy, if they mentioned one; otherwise null",
        },
      },
      required: ["symbol", "trade_amount_thb"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_protection",
    description:
      "Offer the user a protection rule for a token with medium or high unlock risk. This only creates a proposal card; nothing happens until the user taps approve, which records the rule on Avalanche. price_alert = alert if price drops 10% before the unlock; pause_buying = pause recurring buys until 14 days after the unlock; reduce_exposure = a reminder to review position size before the unlock.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        symbol: symbolProp,
        action: { type: "string", enum: ["price_alert", "pause_buying", "reduce_exposure"] },
      },
      required: ["symbol", "action"],
      additionalProperties: false,
    },
  },
];

// ─── Input validation (the agent's tool inputs are untrusted model output) ──────

const Sym = z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9.\-]+$/);
const INPUTS = {
  get_portfolio: z.object({}),
  lookup_token: z.object({ symbol: Sym }),
  get_unlock_schedule: z.object({ symbol: Sym, days: z.number().int().min(1).max(90) }),
  get_allocations: z.object({ symbol: Sym }),
  get_fundraising: z.object({ symbol: Sym }),
  assess_unlock_risk: z.object({ symbol: Sym, trade_amount_thb: z.number().positive().nullable() }),
  propose_protection: z.object({ symbol: Sym, action: z.enum(["price_alert", "pause_buying", "reduce_exposure"]) }),
} as const;

export type ToolName = keyof typeof INPUTS;

export interface RunContext {
  cards: Map<string, RiskCard>;
  proposals: Proposal[];
  trace: TraceStep[];
}

export function newContext(): RunContext {
  return { cards: new Map(), proposals: [], trace: [] };
}

interface ToolOutput {
  result: unknown;
  summary: string;
}

const ACTION_COPY: Record<ProtectionAction, (s: string, date: string) => { title: string; detail: string }> = {
  price_alert: (s, date) => ({
    title: `ตั้งแจ้งเตือนราคา ${s} ก่อนวัน unlock`,
    detail: `U-Bot จะเตือนถ้าราคา ${s} ลดลง 10% ก่อน ${date} และบันทึกกฎนี้บน Avalanche`,
  }),
  pause_buying: (s, date) => ({
    title: `พักการซื้ออัตโนมัติ ${s} ช่วง unlock`,
    detail: `หยุด DCA ของ ${s} ตั้งแต่วันนี้จนถึง 14 วันหลัง ${date} (ช่วงที่ความผันผวนมักกลับสู่ปกติ) และบันทึกกฎนี้บน Avalanche`,
  }),
  reduce_exposure: (s, date) => ({
    title: `เตือนให้ทบทวนสัดส่วน ${s}`,
    detail: `U-Bot จะเตือน 7 วันก่อน ${date} ให้ทบทวนสัดส่วน ${s} ในพอร์ต (คุณตัดสินใจและทำรายการเอง) และบันทึกกฎนี้บน Avalanche`,
  }),
};

async function run(name: ToolName, input: Record<string, unknown>, ctx: RunContext): Promise<ToolOutput> {
  switch (name) {
    case "get_portfolio": {
      const holdings = await getHoldings();
      return {
        result: holdings.map((h) => ({ symbol: h.symbol, amount: h.amount, value_thb: Math.round(h.valueThb), data: h.source })),
        summary: holdings.map((h) => h.symbol).join(", "),
      };
    }
    case "lookup_token": {
      const { token, meta } = await findToken(input.symbol as string);
      if (!token) return { result: { found: false }, summary: `${input.symbol}: not tracked` };
      const quote = await getQuote(token.symbol);
      const price = quote?.priceUsd ?? token.marketCap / token.circulatingSupply;
      return {
        result: {
          found: true,
          name: token.name,
          symbol: token.symbol,
          price_usd: price,
          market_cap_usd: token.marketCap,
          fdv_usd: price * token.maxSupply,
          circulating_pct_of_max: (token.circulatingSupply / token.maxSupply) * 100,
          latest_round: token.latestFundraisingRound,
          data: meta.source,
        },
        summary: `${token.symbol} mcap ${usd(token.marketCap)} · ${((token.circulatingSupply / token.maxSupply) * 100).toFixed(0)}% circulating`,
      };
    }
    case "get_unlock_schedule": {
      const { token } = await findToken(input.symbol as string);
      if (!token) return { result: { found: false }, summary: `${input.symbol}: not tracked` };
      const days = input.days as number;
      const start = new Date().toISOString().slice(0, 10);
      const end = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
      const events = await getUnlockEvents(token.id, start, end);
      const rows = events.data.map((e) => ({
        date: e.unlockDate,
        amount: e.cliffUnlocks?.cliffAmount ?? 0,
        recipients: (e.cliffUnlocks?.allocationBreakdown ?? []).map((a) => ({
          name: a.allocationName,
          category: a.standardAllocationName,
          amount: a.cliffAmount,
        })),
      }));
      return {
        result: { symbol: token.symbol, window_days: days, events: rows, data: events.source },
        summary: `${token.symbol}: ${rows.length} event(s) in ${days}d${rows[0] ? ` · next ${thaiDate(rows[0].date)}` : ""}`,
      };
    }
    case "get_allocations": {
      const { token } = await findToken(input.symbol as string);
      if (!token) return { result: { found: false }, summary: `${input.symbol}: not tracked` };
      const alloc = await getAllocations(token.id);
      const rows = (alloc.data?.allocations ?? []).map((a) => ({
        name: a.allocationName,
        category: a.standardAllocationName,
        pct_of_supply: a.trackedAllocationPercentage,
        locked: a.allocationLockedAmount,
      }));
      return {
        result: { symbol: token.symbol, allocations: rows, data: alloc.source },
        summary: `${token.symbol}: ${rows.length} allocation buckets`,
      };
    }
    case "get_fundraising": {
      const { token } = await findToken(input.symbol as string);
      if (!token) return { result: { found: false }, summary: `${input.symbol}: not tracked` };
      const fund = await getFundraising(token.id);
      const rounds = (fund.data?.fundingRounds ?? []).map((r) => ({
        round: r.fundingRound,
        date: r.fundingDate,
        raised_usd: r.amountRaised,
        valuation_usd: r.valuation,
        price_per_token: r.pricePerToken,
      }));
      return {
        result: { symbol: token.symbol, total_raised_usd: fund.data?.totalAmountRaised ?? null, rounds, data: fund.source },
        summary: `${token.symbol}: ${rounds.length} round(s)${fund.data?.totalAmountRaised ? ` · raised ${usd(fund.data.totalAmountRaised)}` : ""}`,
      };
    }
    case "assess_unlock_risk": {
      const res = await assessUnlockRisk(input.symbol as string, (input.trade_amount_thb as number | null) ?? null);
      if (!res.ok) return { result: { tracked: false, note: res.reason }, summary: `${input.symbol}: no unlock data` };
      const c = res.card;
      ctx.cards.set(c.symbol, c);
      return {
        result: {
          symbol: c.symbol,
          level: c.level,
          score: c.score,
          unlock_date: c.unlockDate,
          days_until: c.daysUntil,
          unlock_amount: c.amount,
          unlock_value_usd: Math.round(c.valueUsd),
          pct_of_circulating: Number(c.pctOfCirculating.toFixed(2)),
          days_of_volume: c.daysOfVolume === null ? null : Number(c.daysOfVolume.toFixed(2)),
          recipients: c.breakdown.map((b) => ({ name: b.name, type: b.recipient, share_pct: Math.round(b.share * 100) })),
          investor_multiple: c.investorMultiple === null ? null : Number(c.investorMultiple.toFixed(1)),
          reasons_th: c.reasons,
          data: c.source.mode,
        },
        summary:
          c.level === "none"
            ? `${c.symbol}: no unlock in 30d`
            : `${c.symbol}: ${c.level.toUpperCase()} ${c.score}/100 · ${compact(c.amount)} in ${c.daysUntil}d`,
      };
    }
    case "propose_protection": {
      const symbol = (input.symbol as string).toUpperCase();
      const card = ctx.cards.get(symbol);
      if (!card || card.level === "low" || card.level === "none") {
        return {
          result: { created: false, note: "Call assess_unlock_risk first; proposals are only for medium or high risk." },
          summary: `${symbol}: proposal rejected (risk not medium/high)`,
        };
      }
      if (ctx.proposals.some((p) => p.symbol === symbol)) {
        return { result: { created: false, note: "A proposal for this token already exists." }, summary: `${symbol}: duplicate` };
      }
      const action = input.action as ProtectionAction;
      const copy = ACTION_COPY[action](symbol, card.unlockDate ? thaiDate(card.unlockDate) : "วัน unlock");
      const proposal: Proposal = {
        id: randomUUID(),
        symbol,
        action,
        riskLevel: card.level,
        unlockDate: card.unlockDate,
        status: "pending",
        ...copy,
      };
      store.proposals.set(proposal.id, proposal);
      ctx.proposals.push(proposal);
      return {
        result: { created: true, proposal_id: proposal.id, status: "pending_user_approval", title: copy.title },
        summary: `${symbol}: proposed ${action} (awaiting approval)`,
      };
    }
  }
}

/** Validates and runs one tool call, recording it in the trace. Never throws. */
export async function executeTool(
  name: string,
  rawInput: unknown,
  ctx: RunContext,
): Promise<{ content: string; isError: boolean }> {
  const t0 = Date.now();
  const schema = INPUTS[name as ToolName];
  if (!schema) {
    ctx.trace.push({ tool: name, input: rawInput, summary: "unknown tool", ms: 0, ok: false });
    return { content: `Unknown tool: ${name}`, isError: true };
  }
  const parsed = schema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    ctx.trace.push({ tool: name, input: rawInput, summary: "invalid input", ms: 0, ok: false });
    return { content: `Invalid input: ${parsed.error.message}`, isError: true };
  }
  try {
    const out = await run(name as ToolName, parsed.data as Record<string, unknown>, ctx);
    ctx.trace.push({ tool: name, input: parsed.data, summary: out.summary, ms: Date.now() - t0, ok: true });
    return { content: JSON.stringify(out.result), isError: false };
  } catch (err) {
    ctx.trace.push({ tool: name, input: parsed.data, summary: (err as Error).message, ms: Date.now() - t0, ok: false });
    return { content: `Tool failed: ${(err as Error).message}`, isError: true };
  }
}
