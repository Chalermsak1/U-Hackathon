// Shared types between the agent (server) and the U-topia UI (client).

import type { Freshness } from "./freshness";

export type { Freshness } from "./freshness";

export type DataSource = "live" | "sample";

export interface Sourced<T> {
  data: T;
  source: DataSource;
  asOf: string;
  fetchedAt: string;
  ttlSeconds: number;
  stale: boolean; // a live fetch failed and this is the last good copy or the fixture
  warning?: string;
}

export type RecipientClass = "team" | "investor" | "community" | "reserve" | "ecosystem" | "other";

export type RiskLevel = "high" | "medium" | "low" | "none";

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
  unlockDate: string | null;
  daysUntil: number | null;
  amount: number;
  valueUsd: number;
  pctOfCirculating: number;
  daysOfVolume: number | null;
  breakdown: RecipientSlice[];
  investorMultiple: number | null;
  reasons: string[]; // short Thai lines, generated deterministically
  factors: { time: number; size: number; liquidity: number; recipient: number; investorBonus: number };
  tradeAmountThb?: number;
  source: { provider: "Tokenomist"; mode: DataSource; asOf: string };
  fresh: Freshness[]; // unlock schedule + price/volume, each with its own as-of time
}

export type ProtectionAction = "price_alert" | "reduce_exposure" | "pause_buying";

export interface Proposal {
  id: string;
  symbol: string;
  action: ProtectionAction;
  title: string; // Thai
  detail: string; // Thai
  riskLevel: RiskLevel;
  unlockDate: string | null;
  status: "pending" | "approved" | "declined";
}

export interface TraceStep {
  tool: string;
  input: unknown;
  summary: string;
  ms: number;
  ok: boolean;
  fresh?: Freshness[];
}

export type NewsEventType =
  | "unlock"
  | "unlock_change"
  | "exploit_hack"
  | "listing"
  | "delisting"
  | "regulatory"
  | "governance_vote"
  | "treasury_move"
  | "macro"
  | "partnership"
  | "other";

export interface NewsItem {
  title: string;
  url: string; // only URLs the search actually returned
  publisher: string; // hostname
  publishedAt: string | null;
  symbols: string[];
  eventType: NewsEventType;
  severity: "high" | "medium" | "low";
  gistTh: string; // one Thai line
}

export interface DriftRow {
  symbol: string;
  valueThb: number;
  weightPct: number;
  targetPct: number | null;
  driftPp: number | null; // weight − target, percentage points
  status: "over" | "under" | "ok" | "no_target";
  riskLevel: RiskLevel | null;
  riskScore: number;
  unlockDate: string | null;
  dilutionPct: number; // 6-month dilution of this holding
}

export interface DriftReport {
  hasTargets: boolean;
  bandPp: number;
  rows: DriftRow[];
  totalThb: number;
  totalDriftPct: number; // ½ Σ |weight − target|
  portfolioRiskScore: number; // Σ weight × unlock risk score, 0..100
  weightedDilutionPct: number;
  concentration: { symbol: string; weightPct: number; hhi: number } | null;
  lines: string[]; // up to 3 plain-Thai lines, deterministic
  fresh: Freshness[];
}

export type AgentMode = "claude" | "offline" | "watch"; // watch = the alert engine (deterministic)

export interface AgentResult {
  reply: string;
  cards: RiskCard[];
  proposals: Proposal[];
  trace: TraceStep[];
  mode: AgentMode;
  note?: string; // e.g. why we fell back to offline
  drift?: DriftReport | null;
  news?: NewsItem[];
  fresh?: Freshness[]; // every source this answer used
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
  fresh: Freshness[]; // wallet amount + price
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
