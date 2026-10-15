// The agent's tools. Every provider (OpenAI-compatible LLM, Anthropic, the rules engine)
// and the MCP endpoint run tools through executeTool(), so validation, the Agent Trace and
// citations behave the same everywhere.

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { compact, shortDate, thaiDate, usd } from "../format";
import { getEventCalendar } from "../intel/calendar";
import { searchNews } from "../intel/news";
import { getEventOdds } from "../intel/odds";
import { getMarketPulse } from "../intel/pulse";
import { getQuote } from "../market";
import { getHoldings } from "../portfolio";
import { assessUnlockRisk } from "../risk";
import { store } from "../store";
import { findToken, getAllocations, getFundraising, getUnlockEvents } from "../tokenomist";
import type {
  CalendarEvent,
  Citation,
  DataSource,
  Holding,
  Locale,
  MarketPulse,
  NewsItem,
  OddsMarket,
  Proposal,
  ProtectionAction,
  RiskCard,
  Sourced,
  TraceStep,
} from "../types";

/** JSON Schema tool spec, written strict-compatible (every property required, no extras). */
export interface ToolSpec {
  name: ToolName;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required: string[]; additionalProperties: false };
}

const symbolProp = { type: "string", description: "Token ticker, e.g. ARB, WLD, AVAX, BTC" } as const;
const noInput = { type: "object", properties: {}, required: [], additionalProperties: false } as const;

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: "get_portfolio",
    description:
      "List the user's holdings in their U-topia self-custody wallet (symbol, amount, value in THB). Call this first when the user asks about their portfolio or what they hold.",
    input_schema: { ...noInput, required: [] },
  },
  {
    name: "lookup_token",
    description: "Tokenomist overview of one token: price, market cap, FDV, share of max supply already circulating, latest fundraising round.",
    input_schema: { type: "object", properties: { symbol: symbolProp }, required: ["symbol"], additionalProperties: false },
  },
  {
    name: "get_unlock_schedule",
    description: "Token unlock events for one token within the next N days, with who receives the tokens.",
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
    input_schema: { type: "object", properties: { symbol: symbolProp }, required: ["symbol"], additionalProperties: false },
  },
  {
    name: "get_fundraising",
    description: "A token's venture funding rounds: date, amount raised, valuation, price per token.",
    input_schema: { type: "object", properties: { symbol: symbolProp }, required: ["symbol"], additionalProperties: false },
  },
  {
    name: "assess_unlock_risk",
    description:
      "Compute the unlock risk score (0-100) and level for one token: upcoming unlocks in the next 30 days, unlocks in the last 14 days, and continuous releases, weighted by size vs circulating supply, size vs daily volume, recipient type and investor profit. The score is authoritative: report it, never recompute it. The app shows the result as a risk card.",
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
      "Offer the user a protection rule for a token with medium or high unlock risk. This only creates a proposal card; nothing happens until the user taps approve, which records the rule on Avalanche. price_alert = alert if price drops 10% around the unlock; pause_buying = pause recurring buys until 14 days after the unlock; reduce_exposure = a reminder to review position size.",
    input_schema: {
      type: "object",
      properties: { symbol: symbolProp, action: { type: "string", enum: ["price_alert", "pause_buying", "reduce_exposure"] } },
      required: ["symbol", "action"],
      additionalProperties: false,
    },
  },
  {
    name: "get_market_news",
    description:
      "Search recent news that can move a token or the market (ETF flows, macro/Fed, regulation, hacks, unlocks). Returns short summaries with source links and citation numbers; cite them as [n]. Returns an empty list when nothing relevant was found: say so instead of guessing.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to look for, e.g. 'bitcoin etf flows' or 'fed rate decision'" },
        symbols: { type: "array", items: symbolProp, description: "Tickers the question is about; empty for market-wide news" },
        days: { type: "integer", description: "How far back to look, in days (1-90)" },
      },
      required: ["query", "symbols", "days"],
      additionalProperties: false,
    },
  },
  {
    name: "get_event_odds",
    description:
      "Prediction-market (Polymarket) probabilities for real-world events related to a topic, e.g. 'fed rate decision' or 'bitcoin'. These are what traders are pricing, not U-Guard's forecast; always attribute them.",
    input_schema: {
      type: "object",
      properties: { topic: { type: "string", description: "Event topic, e.g. 'fed', 'bitcoin', 'recession'" } },
      required: ["topic"],
      additionalProperties: false,
    },
  },
  {
    name: "get_market_pulse",
    description:
      "Current market readings: BTC price and 24h change, the Fear & Greed sentiment index, recent ETF flows, and the options-implied 7-day BTC range when available.",
    input_schema: { ...noInput, required: [] },
  },
  {
    name: "get_event_calendar",
    description: "Scheduled events in the next N days that can move prices: Fed (FOMC) decisions and token unlocks.",
    input_schema: {
      type: "object",
      properties: { days: { type: "integer", description: "Look-ahead window in days (1-90)" } },
      required: ["days"],
      additionalProperties: false,
    },
  },
];

// ─── Input validation (tool inputs are untrusted model or MCP-client output) ──────────

const Sym = z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9.\-]+$/);
const Days = z.number().int().min(1).max(90);
const INPUTS = {
  get_portfolio: z.object({}),
  lookup_token: z.object({ symbol: Sym }),
  get_unlock_schedule: z.object({ symbol: Sym, days: Days.default(30) }),
  get_allocations: z.object({ symbol: Sym }),
  get_fundraising: z.object({ symbol: Sym }),
  assess_unlock_risk: z.object({ symbol: Sym, trade_amount_thb: z.number().positive().max(1e9).nullable().default(null) }),
  propose_protection: z.object({ symbol: Sym, action: z.enum(["price_alert", "pause_buying", "reduce_exposure"]) }),
  get_market_news: z.object({
    query: z.string().trim().max(160).default(""),
    symbols: z.array(Sym).max(5).default([]),
    days: Days.default(14),
  }),
  get_event_odds: z.object({ topic: z.string().trim().min(2).max(80) }),
  get_market_pulse: z.object({}),
  get_event_calendar: z.object({ days: Days.default(45) }),
} as const;

export type ToolName = keyof typeof INPUTS;
export const TOOL_NAMES = Object.keys(INPUTS) as ToolName[];

// ─── Per-request context ─────────────────────────────────────────────────────────────

export interface RunContext {
  userId: string;
  locale: Locale; // language of the user's message: replies and proposals follow it
  scope: "user" | "public"; // public = signed-out visitor: no wallet tools
  requestId: string;
  now: number;
  cards: Map<string, RiskCard>;
  notes: Map<string, string>; // symbol → why there is no card (no vesting / not covered)
  proposals: Proposal[];
  news: Sourced<NewsItem[]> | null;
  odds: Sourced<OddsMarket[]> | null;
  pulse: Sourced<MarketPulse> | null;
  calendar: CalendarEvent[] | null;
  holdings: Holding[] | null;
  citations: Citation[];
  trace: TraceStep[];
  evidence: string[]; // serialized tool results: the only numbers a reply may use
  sources: Set<DataSource>;
}

export function newContext(init: { userId: string; scope: "user" | "public"; requestId: string; now: number; locale?: Locale }): RunContext {
  return {
    ...init,
    locale: init.locale ?? "en",
    cards: new Map(),
    notes: new Map(),
    proposals: [],
    news: null,
    odds: null,
    pulse: null,
    calendar: null,
    holdings: null,
    citations: [],
    trace: [],
    evidence: [],
    sources: new Set(),
  };
}

interface ToolOutput {
  result: unknown;
  summary: string;
}

function protectionCopy(action: ProtectionAction, s: string, card: RiskCard): { title: string; detail: string } {
  const date = card.unlockDate ? shortDate(card.unlockDate) : "the unlock";
  const twoWeeksAfter = card.unlockDate ? shortDate(new Date(Date.parse(card.unlockDate) + 14 * 86_400_000).toISOString()) : null;
  const window =
    card.timing === "continuous" ? "over the next 30 days" : card.timing === "recent" ? "over the next two weeks" : `before ${date}`;
  switch (action) {
    case "price_alert":
      return {
        title: `Price alert for ${s} around the unlock`,
        detail: `U-Bot alerts you if ${s} falls 10% ${window}. The rule is recorded on Avalanche when you approve.`,
      };
    case "pause_buying":
      return {
        title: `Pause auto-buys of ${s} through the unlock window`,
        detail:
          card.timing === "continuous" || !twoWeeksAfter
            ? `Pauses recurring ${s} buys for the next 30 days while supply keeps entering the market. Recorded on Avalanche when you approve.`
            : `Pauses recurring ${s} buys until ${twoWeeksAfter}, two weeks after the unlock, when volatility usually settles. Recorded on Avalanche when you approve.`,
      };
    case "reduce_exposure":
      return {
        title: `Reminder to review your ${s} position`,
        detail: `U-Bot reminds you ${card.timing === "upcoming" && (card.daysUntil ?? 0) > 7 ? `7 days before ${date}` : "tomorrow"} to review how much ${s} you hold. You decide and trade yourself. Recorded on Avalanche when you approve.`,
      };
  }
}

/** Thai copy for the same rules (the U-topia app speaks Thai). */
function protectionCopyTh(action: ProtectionAction, s: string, card: RiskCard): { title: string; detail: string } {
  const date = card.unlockDate ? thaiDate(card.unlockDate) : "วัน unlock";
  const twoWeeksAfter = card.unlockDate ? thaiDate(new Date(Date.parse(card.unlockDate) + 14 * 86_400_000).toISOString()) : null;
  const window =
    card.timing === "continuous" ? "ในอีก 30 วันข้างหน้า" : card.timing === "recent" ? "ในอีก 2 สัปดาห์ข้างหน้า" : `ก่อน ${date}`;
  switch (action) {
    case "price_alert":
      return {
        title: `ตั้งแจ้งเตือนราคา ${s} ช่วง unlock`,
        detail: `U-Bot จะเตือนถ้าราคา ${s} ลดลง 10% ${window} และบันทึกกฎนี้บน Avalanche เมื่อคุณอนุมัติ`,
      };
    case "pause_buying":
      return {
        title: `พักการซื้ออัตโนมัติ ${s} ช่วง unlock`,
        detail:
          card.timing === "continuous" || !twoWeeksAfter
            ? `หยุด DCA ของ ${s} ในอีก 30 วันข้างหน้า ระหว่างที่เหรียญใหม่ยังทยอยเข้าตลาด และบันทึกกฎนี้บน Avalanche เมื่อคุณอนุมัติ`
            : `หยุด DCA ของ ${s} ตั้งแต่วันนี้จนถึง ${twoWeeksAfter} (2 สัปดาห์หลัง unlock ช่วงที่ความผันผวนมักกลับสู่ปกติ) และบันทึกกฎนี้บน Avalanche เมื่อคุณอนุมัติ`,
      };
    case "reduce_exposure":
      return {
        title: `เตือนให้ทบทวนสัดส่วน ${s}`,
        detail: `U-Bot จะเตือน${card.timing === "upcoming" && (card.daysUntil ?? 0) > 7 ? ` 7 วันก่อน ${date}` : "พรุ่งนี้"} ให้ทบทวนสัดส่วน ${s} ในพอร์ต (คุณตัดสินใจและทำรายการเอง) และบันทึกกฎนี้บน Avalanche เมื่อคุณอนุมัติ`,
      };
  }
}

function addNews(ctx: RunContext, res: Sourced<NewsItem[]>): { n: number; item: NewsItem }[] {
  const merged = ctx.news ? [...ctx.news.data] : [];
  const out: { n: number; item: NewsItem }[] = [];
  for (const item of res.data) {
    let cite = ctx.citations.find((c) => c.url === item.url && c.title === item.summary);
    if (!cite) {
      cite = { n: ctx.citations.length + 1, title: item.summary, url: item.url, source: item.source };
      ctx.citations.push(cite);
      merged.push(item);
    }
    out.push({ n: cite.n, item });
  }
  ctx.news = { ...res, data: merged };
  return out;
}

const WALLET_TOOLS = new Set<ToolName>(["get_portfolio", "propose_protection"]);

async function run(name: ToolName, input: Record<string, unknown>, ctx: RunContext): Promise<ToolOutput> {
  if (ctx.scope === "public" && WALLET_TOOLS.has(name)) {
    return { result: { error: "sign_in_required", note: "The user is signed out. Ask them to sign in to use their wallet." }, summary: "sign-in required" };
  }
  switch (name) {
    case "get_portfolio": {
      const holdings = await getHoldings();
      ctx.holdings = holdings;
      holdings.forEach((h) => ctx.sources.add(h.source));
      return {
        result: holdings.map((h) => ({ symbol: h.symbol, amount: h.amount, value_thb: Math.round(h.valueThb), data: h.source })),
        summary: holdings.map((h) => h.symbol).join(", "),
      };
    }
    case "lookup_token": {
      const { token, meta } = await findToken(input.symbol as string);
      if (!token) return { result: { found: false }, summary: `${input.symbol}: not in dataset` };
      const quote = await getQuote(token.symbol);
      const price = quote?.priceUsd ?? (token.circulatingSupply > 0 ? token.marketCap / token.circulatingSupply : 0);
      const circPct = token.maxSupply > 0 ? (token.circulatingSupply / token.maxSupply) * 100 : null;
      ctx.sources.add(meta.source);
      return {
        result: {
          found: true,
          name: token.name,
          symbol: token.symbol,
          price_usd: price,
          market_cap_usd: token.marketCap,
          fdv_usd: price * token.maxSupply,
          circulating_pct_of_max: circPct === null ? null : Number(circPct.toFixed(2)),
          latest_round: token.latestFundraisingRound,
          data: meta.source,
        },
        summary: `${token.symbol} mcap ${usd(token.marketCap)}${circPct === null ? "" : ` · ${circPct.toFixed(0)}% circulating`}`,
      };
    }
    case "get_unlock_schedule": {
      const { token } = await findToken(input.symbol as string);
      if (!token) return { result: { found: false }, summary: `${input.symbol}: not in dataset` };
      const days = input.days as number;
      const start = new Date(ctx.now).toISOString().slice(0, 10);
      const end = new Date(ctx.now + days * 86_400_000).toISOString().slice(0, 10);
      const events = await getUnlockEvents(token.id, start, end);
      ctx.sources.add(events.source);
      const rows = events.data.map((e) => ({
        date: e.unlockDate.slice(0, 10),
        type: e.cliffUnlocks ? "cliff" : "linear",
        amount: e.cliffUnlocks?.cliffAmount ?? e.linearUnlocks?.linearAmount ?? 0,
        recipients: (e.cliffUnlocks?.allocationBreakdown ?? e.linearUnlocks?.allocationBreakdown ?? []).map((a) => ({
          name: a.allocationName,
          category: a.standardAllocationName,
          amount: "cliffAmount" in a ? a.cliffAmount : (a.linearAmount ?? a.amount ?? null),
        })),
      }));
      return {
        result: { symbol: token.symbol, window_days: days, events: rows, data: events.source },
        summary: `${token.symbol}: ${rows.length} event(s) in ${days}d${rows[0] ? ` · next ${shortDate(rows[0].date)}` : ""}`,
      };
    }
    case "get_allocations": {
      const { token } = await findToken(input.symbol as string);
      if (!token) return { result: { found: false }, summary: `${input.symbol}: not in dataset` };
      const alloc = await getAllocations(token.id);
      ctx.sources.add(alloc.source);
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
      if (!token) return { result: { found: false }, summary: `${input.symbol}: not in dataset` };
      const fund = await getFundraising(token.id);
      ctx.sources.add(fund.source);
      const rounds = (fund.data?.fundingRounds ?? []).map((r) => ({
        round: r.fundingRound,
        date: r.fundingDate.slice(0, 10),
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
      const sym = (input.symbol as string).toUpperCase();
      const res = await assessUnlockRisk(sym, (input.trade_amount_thb as number | null) ?? null, { now: ctx.now, locale: ctx.locale });
      if (!res.ok) {
        ctx.notes.set(res.symbol, res.reason);
        return {
          result: { symbol: res.symbol, rated: false, kind: res.kind, note: res.reason },
          summary: `${res.symbol}: ${res.kind === "no_vesting" ? "no vesting schedule" : "not in dataset"}`,
        };
      }
      const c = res.card;
      ctx.cards.set(c.symbol, c);
      ctx.sources.add(c.source.mode);
      return {
        result: {
          symbol: c.symbol,
          level: c.level,
          score: c.score,
          timing: c.timing,
          unlock_date: c.unlockDate ? c.unlockDate.slice(0, 10) : null,
          days_until: c.daysUntil,
          unlock_amount: Math.round(c.amount),
          unlock_value_usd: Math.round(c.valueUsd),
          pct_of_circulating: Number(c.pctOfCirculating.toFixed(2)),
          days_of_volume: c.daysOfVolume === null ? null : Number(c.daysOfVolume.toFixed(2)),
          recipients: c.breakdown.map((b) => ({ name: b.name, type: b.recipient, share_pct: Math.round(b.share * 100) })),
          investor_multiple: c.investorMultiple === null ? null : Number(c.investorMultiple.toFixed(1)),
          next_unlock: c.nextUnlock ? { date: c.nextUnlock.date.slice(0, 10), amount: c.nextUnlock.amount } : null,
          reasons: c.reasons,
          data: c.source.mode,
        },
        summary:
          c.level === "none"
            ? `${c.symbol}: no unlock in 30d`
            : `${c.symbol}: ${c.level.toUpperCase()} ${c.score}/100 · ${compact(c.amount, 2)} ${c.timing}`,
      };
    }
    case "propose_protection": {
      const symbol = (input.symbol as string).toUpperCase();
      let card = ctx.cards.get(symbol);
      // Stateless callers (MCP: one request per tool call) can't carry the card over from an
      // earlier assess_unlock_risk call, so score it here. The medium/high gate below still applies.
      if (!card) {
        const res = await assessUnlockRisk(symbol, null, { now: ctx.now, locale: ctx.locale });
        if (res.ok) {
          card = res.card;
          ctx.cards.set(card.symbol, card);
          ctx.sources.add(card.source.mode);
        }
      }
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
      const proposal: Proposal = {
        id: randomUUID(),
        symbol,
        action,
        riskLevel: card.level,
        unlockDate: card.unlockDate,
        status: "pending",
        ...(ctx.locale === "th" ? protectionCopyTh(action, symbol, card) : protectionCopy(action, symbol, card)),
      };
      store.proposals.set(proposal.id, { proposal, ownerId: ctx.userId, createdAt: Date.now() });
      ctx.proposals.push(proposal);
      return {
        result: { created: true, proposal_id: proposal.id, status: "pending_user_approval", title: proposal.title },
        summary: `${symbol}: proposed ${action} (awaiting approval)`,
      };
    }
    case "get_market_news": {
      const res = await searchNews({
        query: input.query as string,
        symbols: (input.symbols as string[]).map((s) => s.toUpperCase()),
        days: input.days as number,
        now: ctx.now,
        limit: 4,
      });
      ctx.sources.add(res.source);
      const items = addNews(ctx, res);
      return {
        result: {
          items: items.map(({ n, item }) => ({
            cite: n,
            summary: item.summary,
            source: item.source,
            date: item.date ?? item.dateLabel ?? null,
            symbols: item.symbols,
          })),
          note: items.length === 0 ? "No relevant news found in this window." : undefined,
          data: res.source,
          as_of: res.asOf.slice(0, 10),
        },
        summary: `${items.length} article(s)${items[0] ? ` · ${items[0].item.source}` : ""}`,
      };
    }
    case "get_event_odds": {
      const res = await getEventOdds(input.topic as string);
      ctx.sources.add(res.source);
      const known = new Set((ctx.odds?.data ?? []).map((m) => m.id));
      ctx.odds = { ...res, data: [...(ctx.odds?.data ?? []), ...res.data.filter((m) => !known.has(m.id))] };
      return {
        result: {
          markets: res.data.map((m) => ({
            question: m.question,
            outcomes: m.outcomes.map((o) => ({ name: o.name, probability_pct: Math.round(o.probability * 100) })),
            provider: m.provider,
            reported_by: m.reportedBy?.name ?? null,
          })),
          note: res.data.length === 0 ? "No prediction market found for this topic." : undefined,
          data: res.source,
          as_of: res.asOf.slice(0, 10),
        },
        summary: `${res.data.length} market(s)`,
      };
    }
    case "get_market_pulse": {
      const res = await getMarketPulse();
      ctx.pulse = res;
      ctx.sources.add(res.source);
      const p = res.data;
      return {
        result: {
          btc_price_usd: p.btc?.priceUsd ?? null,
          btc_change_24h_pct: p.btc?.change24hPct ?? null,
          btc_price_date: p.btc?.date ?? null,
          sentiment: p.sentiment ? { value: p.sentiment.value, label: p.sentiment.label, date: p.sentiment.date } : null,
          etf_flows: p.etfFlows.map((f) => ({ asset: f.asset, period: f.label, net_usd: f.netUsd })),
          implied_7d_range: p.impliedMove
            ? { one_sigma_pct: Number(p.impliedMove.pct.toFixed(1)), low: Math.round(p.impliedMove.low), high: Math.round(p.impliedMove.high) }
            : null,
          data: res.source,
        },
        summary: p.btc ? `BTC ${usd(p.btc.priceUsd)}${p.sentiment ? ` · F&G ${p.sentiment.value}` : ""}` : "no data",
      };
    }
    case "get_event_calendar": {
      const events = await getEventCalendar(input.days as number, { now: ctx.now });
      ctx.calendar = events;
      return {
        result: { events: events.map((e) => ({ date: e.date, title: e.title, kind: e.kind, importance: e.importance })) },
        summary: `${events.length} event(s) in ${input.days}d`,
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
    ctx.trace.push({ kind: "tool", name, input: rawInput, summary: "unknown tool", ms: 0, ok: false });
    return { content: `Unknown tool: ${name}`, isError: true };
  }
  const parsed = schema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    ctx.trace.push({ kind: "tool", name, input: rawInput, summary: "invalid input", ms: 0, ok: false });
    return { content: `Invalid input: ${parsed.error.message}`, isError: true };
  }
  try {
    const out = await run(name as ToolName, parsed.data as Record<string, unknown>, ctx);
    const content = JSON.stringify(out.result);
    ctx.evidence.push(content);
    ctx.trace.push({ kind: "tool", name, input: parsed.data, summary: out.summary, ms: Date.now() - t0, ok: true });
    return { content, isError: false };
  } catch (err) {
    ctx.trace.push({ kind: "tool", name, input: parsed.data, summary: (err as Error).message, ms: Date.now() - t0, ok: false });
    return { content: `Tool failed: ${(err as Error).message}`, isError: true };
  }
}
