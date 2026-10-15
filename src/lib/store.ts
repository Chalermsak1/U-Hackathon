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

export interface AlertRule {
  id: string;
  createdAt: string;
  ownerId: string;
  symbol: string;
  minLevel: "medium" | "high";
  daysBefore: number;
  channel: "ubot" | "telegram" | "line";
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
  /** userId:ruleId:unlockDate → when that alert last fired (cooldown). */
  alertsFired: Map<string, number>;
  feedback: FeedbackRecord[];
  /** Trade plans drafted for a user, awaiting their decision. */
  tradePlans: Map<string, { plan: TradePlan; ownerId: string }>;
  /** Paper orders per user, newest last. */
  orders: Map<string, PaperOrder[]>;
  /** Invest plans drafted for a user (pending or decided). */
  investPlans: Map<string, { plan: InvestPlan; ownerId: string }>;
}

const g = globalThis as typeof globalThis & { __uguard?: Store };
export const store: Store = (g.__uguard ??= {
  proposals: new Map(),
  inbox: new Map(),
  alerts: [],
  alertsFired: new Map(),
  feedback: [],
  tradePlans: new Map(),
  orders: new Map(),
  investPlans: new Map(),
});
// A store created by an older build during hot reload may lack the newer fields.
store.alerts ??= [];
store.alertsFired ??= new Map();
store.feedback ??= [];
store.tradePlans ??= new Map();
store.orders ??= new Map();
store.investPlans ??= new Map();
