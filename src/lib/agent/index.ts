// Picks the agent per AGENT_MODE and logs every run.
//   claude  → Claude only (errors surface to the user)
//   offline → deterministic agent only
//   auto    → Claude, falling back to the offline agent on any error

import { config } from "../config";
import { writeLog } from "../log";
import type { AgentResult, ChatTurn } from "../types";
import { runClaudeAgent } from "./claude";
import { runOfflineAgent } from "./offline";

export async function runAgent(message: string, history: ChatTurn[], route = "/api/agent"): Promise<AgentResult> {
  const t0 = Date.now();
  let result: AgentResult;

  if (config.agent.mode === "offline") {
    result = await runOfflineAgent(message, history);
  } else {
    try {
      result = await runClaudeAgent(message, history);
    } catch (err) {
      if (config.agent.mode === "claude") throw err;
      result = await runOfflineAgent(message, history);
      const msg = (err as Error).message;
      const why = /authentication|api.?key|auth/i.test(msg) ? "ยังไม่ได้ตั้ง ANTHROPIC_API_KEY" : msg.slice(0, 120);
      result.note = `Claude ใช้งานไม่ได้ (${why}) จึงตอบด้วย offline agent`;
    }
  }

  await writeLog({
    type: "agent",
    route,
    mode: result.mode,
    ms: Date.now() - t0,
    message: message.slice(0, 200),
    cards: result.cards.map((c) => ({ symbol: c.symbol, level: c.level, score: c.score })),
    proposals: result.proposals.length,
    trace: result.trace.map((t) => ({ tool: t.tool, ms: t.ms, ok: t.ok, summary: t.summary })),
    note: result.note,
  });
  return result;
}
