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

/** The user's own target mix: percent of portfolio value per token, and the drift band. */
export interface Targets {
  targets: Record<string, number>;
  bandPp: number; // drift band in percentage points
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
  /** Target mix per user (portfolio drift). */
  targets: Map<string, Targets>;
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
  targets: new Map(),
});
// A store created by an older build during hot reload may lack the newer fields.
store.alerts ??= [];
store.alertsFired ??= new Map();
store.feedback ??= [];
store.tradePlans ??= new Map();
store.orders ??= new Map();
store.investPlans ??= new Map();
store.targets ??= new Map();

// ─── Shared persistence for serverless hosting (optional) ───────────────────────────
// On Vercel every route runs in its own function with its own memory, so a proposal U-Bot
// drops into the inbox (/api/mcp) would be invisible to the bell (/api/ubot/inbox). With an
// Upstash Redis (KV_REST_API_URL/TOKEN from the Vercel integration, or UPSTASH_REDIS_REST_*)
// each wrapped route loads the latest snapshot first and saves it when it changed anything.
// Without those variables this is a no-op and the in-memory store works as before.

const KV_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const KV_KEY = "uguard:store:v1";
const sync = ((globalThis as typeof globalThis & { __uguardSync?: { version: number } }).__uguardSync ??= { version: 0 });

export const sharedStoreEnabled = Boolean(KV_URL && KV_TOKEN);

function snapshot(): string {
  return JSON.stringify({
    proposals: [...store.proposals],
    inbox: [...store.inbox],
    alerts: store.alerts,
    alertsFired: [...store.alertsFired],
    feedback: store.feedback.slice(-200),
    tradePlans: [...store.tradePlans],
    orders: [...store.orders],
    investPlans: [...store.investPlans],
    targets: [...store.targets],
  });
}

function restore(json: string): void {
  const s = JSON.parse(json);
  store.proposals = new Map(s.proposals ?? []);
  store.inbox = new Map(s.inbox ?? []);
  store.alerts = s.alerts ?? [];
  store.alertsFired = new Map(s.alertsFired ?? []);
  store.feedback = s.feedback ?? [];
  store.tradePlans = new Map(s.tradePlans ?? []);
  store.orders = new Map(s.orders ?? []);
  store.investPlans = new Map(s.investPlans ?? []);
  store.targets = new Map(s.targets ?? []);
}

async function kv(path: string, body?: string): Promise<unknown> {
  const res = await fetch(`${KV_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`KV ${res.status}`);
  return ((await res.json()) as { result?: unknown }).result;
}

/** Loads the shared snapshot if it is newer than what this instance has. Never throws. */
export async function pullStore(): Promise<void> {
  if (!sharedStoreEnabled) return;
  try {
    const raw = (await kv(`/get/${KV_KEY}`)) as string | null;
    if (!raw) return;
    const { v, data } = JSON.parse(raw) as { v: number; data: string };
    if (v > sync.version) {
      restore(data);
      sync.version = v;
    }
  } catch {
    // Keep serving from memory if the KV store is unreachable.
  }
}

/** Saves the store as the newest shared snapshot. Never throws. */
export async function pushStore(): Promise<void> {
  if (!sharedStoreEnabled) return;
  try {
    const v = Math.max(Date.now(), sync.version + 1);
    await kv(`/set/${KV_KEY}`, JSON.stringify({ v, data: snapshot() }));
    sync.version = v;
  } catch {
    // Best effort; the next write retries with the full state.
  }
}

/** Wraps a route handler: pull the shared store first, push it back if the handler changed it. */
export function withStore<A extends unknown[]>(handler: (...args: A) => Promise<Response>): (...args: A) => Promise<Response> {
  if (!sharedStoreEnabled) return handler;
  return async (...args: A) => {
    await pullStore();
    const before = snapshot();
    const res = await handler(...args);
    if (snapshot() !== before) await pushStore();
    return res;
  };
}
