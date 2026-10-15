// Process-wide in-memory state for the demo (proposals awaiting approval, U-Bot inbox,
// feedback). Kept on globalThis so every route bundle and hot reload sees the same
// instance. Swap for Postgres/Supabase before this outlives the hackathon.

import type { AgentResult, Proposal, ProtectionReceipt } from "./types";

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
  feedback: FeedbackRecord[];
}

const g = globalThis as typeof globalThis & { __uguard?: Store };
export const store: Store = (g.__uguard ??= { proposals: new Map(), inbox: new Map(), feedback: [] });
