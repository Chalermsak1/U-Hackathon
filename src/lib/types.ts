// Shared types between the agent (server) and the UI (client).

/** live = fetched now · snapshot = real data captured on `asOf` · sample = illustrative demo data */
/** Language of the user's message. Replies, proposal copy and risk reasons follow it. */
export type Locale = "en" | "th";

export type DataSource = "live" | "snapshot" | "sample";

export interface Sourced<T> {
  data: T;
  source: DataSource;
  asOf: string;
  warning?: string;
}

export interface SourceRef {
  name: string;
  url: string;
}

export type RecipientClass = "team" | "investor" | "community" | "reserve" | "ecosystem" | "other";

export type RiskLevel = "high" | "medium" | "low" | "none";

/** upcoming = cliff ahead · recent = cliff just happened · continuous = linear release · none = nothing in window */
export type UnlockTiming = "upcoming" | "recent" | "continuous" | "none";

export interface RecipientSlice {
  name: string;
  recipient: RecipientClass;
  amount: number;
  valueUsd: number;
  share: number; // 0..1 of this unlock's value
}

export interface RiskCard {
  symbol: string;
  name: string;
  level: RiskLevel;
  score: number; // 0..100, computed in code (never by the LLM)
  timing: UnlockTiming;
  unlockDate: string | null; // cliff date, or window start for continuous unlocks
  daysUntil: number | null; // negative once the unlock has passed
  windowDays: number | null; // continuous unlocks only
  amount: number;
  valueUsd: number;
  pctOfCirculating: number;
  daysOfVolume: number | null;
  breakdown: RecipientSlice[];
  investorMultiple: number | null;
  nextUnlock: { date: string; amount: number } | null; // the following cliff, for context
  headline: string; // one-line summary
  reasons: string[]; // short English lines, generated deterministically
  plain: string; // beginner explanation
  factors: { time: number; size: number; liquidity: number; recipient: number; investorBonus: number };
  tradeAmountThb?: number;
  source: { provider: "Tokenomist"; mode: DataSource; asOf: string };
}

export type ProtectionAction = "price_alert" | "reduce_exposure" | "pause_buying";

export interface Proposal {
  id: string;
  symbol: string;
  action: ProtectionAction;
  title: string;
  detail: string;
  riskLevel: RiskLevel;
  unlockDate: string | null;
  status: "pending" | "approved" | "declined";
}

export type TraceKind = "guard" | "plan" | "tool" | "llm" | "reflect";

export interface TraceStep {
  kind: TraceKind;
  name: string; // tool name, provider name, or guard/check name
  input?: unknown;
  summary: string;
  ms: number;
  ok: boolean;
}

export type AgentProvider = "openai" | "anthropic" | "rules";

export type AnswerMode = "beginner" | "pro";

export interface NewsItem {
  id: string;
  summary: string;
  source: string;
  url: string;
  date: string | null; // report or event date (YYYY-MM-DD)
  dateLabel?: string;
  symbols: string[];
  topics: string[];
  sentiment?: "positive" | "negative" | "neutral" | null;
  relevance?: number;
}

export interface OddsMarket {
  id: string;
  question: string;
  outcomes: { name: string; probability: number }[];
  provider: string;
  url: string;
  reportedBy?: SourceRef;
  endDate: string | null;
  volumeUsd: number | null;
}

export interface MarketPulse {
  btc: { priceUsd: number; change24hPct: number | null; date: string; source: SourceRef } | null;
  sentiment: { value: number; label: string; date: string; source: SourceRef } | null;
  etfFlows: { asset: string; label: string; netUsd: number; source: SourceRef }[];
  impliedMove: {
    asset: string;
    days: number;
    pct: number; // one standard deviation, in percent
    low: number;
    high: number;
    source: SourceRef;
  } | null;
}

export interface CalendarEvent {
  date: string; // YYYY-MM-DD
  title: string;
  kind: "macro" | "unlock";
  importance: "high" | "medium" | "low";
  symbol?: string;
  source: SourceRef;
}

export interface ComplianceReport {
  status: "pass" | "fixed" | "rewritten" | "replaced";
  issues: string[];
}

export interface Citation {
  n: number;
  title: string;
  url: string;
  source: string;
}

export interface AgentResult {
  requestId: string;
  reply: string;
  cards: RiskCard[];
  news: Sourced<NewsItem[]> | null;
  odds: Sourced<OddsMarket[]> | null;
  pulse: Sourced<MarketPulse> | null;
  calendar: CalendarEvent[] | null;
  proposals: Proposal[];
  trace: TraceStep[];
  citations: Citation[];
  provider: AgentProvider;
  model: string | null;
  compliance: ComplianceReport;
  note?: string; // e.g. why we fell back to the rules engine
  usage?: { inputTokens: number; outputTokens: number };
  ms: number;
  now: string; // the agent's clock (DEMO_NOW when set), ISO
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface Holding {
  symbol: string;
  name: string;
  amount: number;
  priceUsd: number;
  valueUsd: number;
  valueThb: number;
  source: DataSource;
}

export interface ProtectionReceipt {
  proposalId: string;
  mode: "onchain" | "simulated";
  chain: string;
  txHash: string | null;
  explorerUrl: string | null;
  memo: string;
  note?: string;
}
