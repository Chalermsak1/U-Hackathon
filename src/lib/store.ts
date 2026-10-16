// Process-wide in-memory state for the demo (proposals awaiting approval, U-Bot inbox, alert
// rules, feedback). Kept on globalThis so every route bundle and hot reload sees the same
// instance. Swap for Postgres/Supabase before this outlives the hackathon.

import type { AgentResult, InvestPlan, PaperOrder, Proposal, ProtectionReceipt, TradePlan } from "./types";

export interface InboxItem {
  id: string;
  at: string;
  kind: "alert" | "reply";
  result: AgentResult;
}

export interface ProposalRecord {
  proposal: Proposal;
  ownerId: string;
  createdAt: number;
  receipt?: ProtectionReceipt;
}

export type AlertType = "unlock" | "drift" | "news";

export interface AlertRule {
  id: string;
  createdAt: string;
  ownerId: string;
  /** unlock = scheduled supply · drift = wallet off the user's target mix · news = market news */
  type?: AlertType; // rules saved before types existed are unlock rules
  symbol: string; // "*" = every non-stablecoin holding (unused for drift)
  minLevel: "medium" | "high"; // unlock risk level, or news severity
  daysBefore: number; // unlock only
  channel: "ubot" | "telegram" | "line";
}

/** One alert that went out (deduplicated by dedupeKey). */
export interface AlertEvent {
  id: string;
  ownerId: string;
  ruleId: string;
  type: AlertType;
  symbol: string;
  severity: "high" | "medium";
  dedupeKey: string;
  firedAt: string;
  title: string;
  lines: string[];
  url?: string;
}

export interface WatchSummary {
  ranAt: string;
  trigger: "timer" | "cron" | "manual";
  fired: AlertEvent[];
  skipped: { title: string; reason: string }[];
}

export interface FeedbackRecord {
  requestId: string;
  userId: string;
  rating: "up" | "down";
  comment?: string;
  at: string;
}

interface Store {
  proposals: Map<string, ProposalRecord>;
  inbox: Map<string, InboxItem[]>;
  alerts: AlertRule[];
  /** Alerts that went out, newest first (dedupe, daily cap, history). */
  alertEvents: AlertEvent[];
  /** Each user's last watch run, for the alerts page. */
  lastWatch: Map<string, WatchSummary>;
  feedback: FeedbackRecord[];
  /** Trade plans drafted for a user, awaiting their decision. */
  tradePlans: Map<string, { plan: TradePlan; ownerId: string }>;
  /** Paper orders per user, newest last. */
  orders: Map<string, PaperOrder[]>;
  /** Invest plans drafted for a user (pending or decided). */
  investPlans: Map<string, { plan: InvestPlan; ownerId: string }>;
  /** Each user's own target mix for drift checks. */
  targets: Map<string, Targets>;
}

export interface Targets {
  targets: Record<string, number>; // percent of portfolio value
  bandPp: number; // drift band, percentage points
}

const g = globalThis as typeof globalThis & { __uguard?: Store };
export const store: Store = (g.__uguard ??= {
  proposals: new Map(),
  inbox: new Map(),
  alerts: [],
  alertEvents: [],
  lastWatch: new Map(),
  feedback: [],
  tradePlans: new Map(),
  orders: new Map(),
  investPlans: new Map(),
  targets: new Map(),
});
// A store created by an older build during hot reload may lack the newer fields.
store.alerts ??= [];
store.alertEvents ??= [];
store.lastWatch ??= new Map();
store.feedback ??= [];
store.tradePlans ??= new Map();
store.orders ??= new Map();
store.investPlans ??= new Map();
store.targets ??= new Map();
