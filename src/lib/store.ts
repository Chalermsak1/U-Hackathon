// Process-wide in-memory state for the demo (proposals, U-Bot inbox, alert rules and
// events, the user's target mix). Kept on globalThis so every route bundle and hot reload
// sees the same instance. Swap for Supabase tables (AGENTIC-WORKFLOW.md §9) after the
// hackathon.

import type { AgentResult, Proposal } from "./types";

export interface InboxItem {
  id: string;
  at: string;
  kind: "alert" | "reply";
  result: AgentResult;
}

export type AlertChannel = "ubot" | "telegram" | "line";

/** symbol "*" means every non-stablecoin holding. */
export type AlertRule = { id: string; createdAt: string; channel: AlertChannel } & (
  | { type: "unlock"; symbol: string; minLevel: "medium" | "high"; daysBefore: number }
  | { type: "drift"; bandPp: number }
  | { type: "news"; symbol: string; minSeverity: "medium" | "high" }
);

export interface AlertEvent {
  id: string;
  ruleId: string;
  type: AlertRule["type"];
  symbol: string;
  severity: "high" | "medium" | "low";
  dedupeKey: string;
  firedAt: string;
  title: string; // Thai
  lines: string[]; // Thai
  channel: AlertChannel;
  url?: string; // news source
}

export interface Targets {
  targets: Record<string, number>; // percent of portfolio value
  bandPp: number; // drift band in percentage points
}

export interface WatchSummary {
  ranAt: string;
  trigger: "cron" | "manual";
  ms: number;
  rules: number;
  checked: string[];
  fired: AlertEvent[];
  skipped: { key: string; title: string; reason: string }[];
  result: AgentResult | null; // the U-Bot message that was sent, if any
}

interface Store {
  proposals: Map<string, Proposal>;
  inbox: Map<string, InboxItem[]>;
  alerts: AlertRule[];
  alertsSeeded: boolean;
  alertEvents: AlertEvent[];
  targets: Targets | null;
  lastWatch: WatchSummary | null;
}

const g = globalThis as typeof globalThis & { __uguard?: Store };
export const store: Store = (g.__uguard ??= {
  proposals: new Map(),
  inbox: new Map(),
  alerts: [],
  alertsSeeded: false,
  alertEvents: [],
  targets: null,
  lastWatch: null,
});
// Older hot-reloaded stores predate these fields.
store.alerts ??= [];
store.alertEvents ??= [];
store.targets ??= null;
store.lastWatch ??= null;
store.alerts = store.alerts.map((r) => ("type" in r ? r : ({ ...(r as object), type: "unlock" } as AlertRule)));

/** Sensible defaults the first time (the user can delete them; they don't come back). */
export function ensureDefaultRules(): AlertRule[] {
  if (!store.alertsSeeded && store.alerts.length === 0) {
    const at = new Date().toISOString();
    store.alerts.push(
      { id: crypto.randomUUID(), createdAt: at, channel: "ubot", type: "unlock", symbol: "*", minLevel: "medium", daysBefore: 7 },
      { id: crypto.randomUUID(), createdAt: at, channel: "ubot", type: "drift", bandPp: 5 },
      { id: crypto.randomUUID(), createdAt: at, channel: "ubot", type: "news", symbol: "*", minSeverity: "high" },
    );
  }
  store.alertsSeeded = true;
  return store.alerts;
}
