// Claude tool-use loop. Manual (not the beta tool runner) so every step lands in the
// Agent Trace and approval stays outside the loop: the agent can only *propose*.

import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, viaGateway } from "../anthropic";
import { config } from "../config";
import type { AgentResult, ChatTurn } from "../types";
import { SYSTEM_PROMPT } from "./prompt";
import { TOOL_DEFINITIONS, executeTool, newContext, resultFromContext } from "./tools";

export async function runClaudeAgent(message: string, history: ChatTurn[]): Promise<AgentResult> {
  const ctx = newContext();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.slice(-8).map((t) => ({ role: t.role, content: t.text }) as Anthropic.Beta.BetaMessageParam),
    { role: "user", content: message },
  ];

  let reply = "";
  for (let turn = 0; turn < config.agent.maxTurns; turn++) {
    const response = await getAnthropic().beta.messages.create({
      model: viaGateway ? config.gateway.model : config.agent.model,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOL_DEFINITIONS,
      messages,
      output_config: { effort: config.agent.effort },
      // On a safety decline, the API retries on Anthropic's recommended fallback model.
      // Sent only to the Anthropic API directly; the gateway has its own model fallbacks.
      ...(viaGateway ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
    });

    if (response.stop_reason === "refusal") {
      reply = "ขออภัย เรื่องนี้ U-Guard ช่วยไม่ได้ ลองถามเรื่องความเสี่ยงจากการปลดล็อกเหรียญดูนะ";
      break;
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");

    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      reply = text;
      break;
    }

    // Append the full content (thinking blocks included) unchanged, then answer every
    // tool call in a single user message.
    messages.push({ role: "assistant", content: response.content });
    const results = await Promise.all(
      toolUses.map(async (call): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        const out = await executeTool(call.name, call.input, ctx);
        return { type: "tool_result", tool_use_id: call.id, content: out.content, is_error: out.isError };
      }),
    );
    messages.push({ role: "user", content: results });
    if (text) reply = text;
  }

  return resultFromContext(ctx, reply || "ตรวจสอบเรียบร้อย ดูรายละเอียดในการ์ดด้านล่างได้เลย", "claude");
}
