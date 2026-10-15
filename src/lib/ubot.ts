// U-Bot adapter. U-Bot is U-topia's agent orchestrator (built on Visa Intelligent
// Commerce); its external interface is not public yet, so U-Guard talks to it through
// this seam:
//   mock    → messages land in an in-memory inbox the /app chat polls (default)
//   webhook → POST to UBOT_WEBHOOK_URL. TODO: match the payload to U-topia's spec.

import { config } from "./config";
import { store, type InboxItem } from "./store";
import type { AgentResult } from "./types";

export interface UBotAdapter {
  name: "mock" | "webhook";
  send(userId: string, kind: InboxItem["kind"], result: AgentResult): Promise<void>;
}

const mock: UBotAdapter = {
  name: "mock",
  async send(userId, kind, result) {
    const items = store.inbox.get(userId) ?? [];
    items.push({ id: crypto.randomUUID(), at: new Date().toISOString(), kind, result });
    store.inbox.set(userId, items.slice(-20));
  },
};

const webhook: UBotAdapter = {
  name: "webhook",
  async send(userId, kind, result) {
    const res = await fetch(config.ubot.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.ubot.apiKey ? { Authorization: `Bearer ${config.ubot.apiKey}` } : {}),
      },
      body: JSON.stringify({
        userId,
        kind,
        text: result.reply,
        cards: result.cards.map((c) => ({ symbol: c.symbol, level: c.level, score: c.score, reasons: c.reasons })),
        actions: result.proposals.map((p) => ({ id: p.id, title: p.title, detail: p.detail })),
      }),
    });
    if (!res.ok) throw new Error(`U-Bot webhook ${res.status}`);
  },
};

export function getUBot(): UBotAdapter {
  return config.ubot.adapter === "webhook" && config.ubot.webhookUrl ? webhook : mock;
}
