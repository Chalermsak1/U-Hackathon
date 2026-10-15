// Shared types between the agent (server) and the U-topia UI (client).

export type DataSource = "live" | "sample";

export interface Sourced<T> {
  data: T;
  source: DataSource;
  asOf: string;
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
}

export type AgentMode = "claude" | "offline";

export interface AgentResult {
  reply: string;
  cards: RiskCard[];
  proposals: Proposal[];
  trace: TraceStep[];
  mode: AgentMode;
  note?: string; // e.g. why we fell back to offline
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
