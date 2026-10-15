// Process-wide in-memory state for the demo (proposals awaiting approval, U-Bot inbox).
// Kept on globalThis so every route bundle and hot reload sees the same instance.
// Swap for Redis/Supabase if this ever outlives the hackathon.

import type { AgentResult, Proposal } from "./types";

export interface InboxItem {
  id: string;
  at: string;
  kind: "alert" | "reply";
  result: AgentResult;
}

interface Store {
  proposals: Map<string, Proposal>;
  inbox: Map<string, InboxItem[]>;
}

const g = globalThis as typeof globalThis & { __uguard?: Store };
export const store: Store = (g.__uguard ??= { proposals: new Map(), inbox: new Map() });
