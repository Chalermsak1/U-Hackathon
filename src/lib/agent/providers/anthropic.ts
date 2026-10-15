// Claude via the official Anthropic SDK (native API: prompt caching, effort, server-side
// refusal fallbacks). Optional: used when AGENT_PROVIDER=anthropic, or in auto mode when only
// ANTHROPIC_API_KEY is set. Claude is never routed through the OpenAI-compatible shim.

import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config";
import type { AnswerMode, ChatTurn } from "../../types";
import { MODE_NOTE, SYSTEM_PROMPT_WITH_KNOWLEDGE } from "../prompt";
import { TOOL_SPECS, executeTool, type RunContext } from "../tools";
import type { LlmRun } from "./openai-compatible";

// Models that accept server-side refusal fallbacks in the `"default"` form. Claude Haiku 5.5
// has no server-side fallback, so the parameter is omitted for it.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"]);

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: config.anthropic.apiKey, timeout: 60_000, maxRetries: 1 });
  return client;
}

const TOOLS: Anthropic.Beta.BetaTool[] = TOOL_SPECS.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.input_schema,
  strict: true,
}));

export function anthropicConfigured(): boolean {
  return Boolean(config.anthropic.apiKey);
}

export async function runAnthropic(args: { message: string; history: ChatTurn[]; mode: AnswerMode; ctx: RunContext }): Promise<LlmRun> {
  const { ctx } = args;
  const model = config.anthropic.model;
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...args.history.map((t) => ({ role: t.role, content: t.text }) as Anthropic.Beta.BetaMessageParam),
    {
      role: "user",
      content: [
        { type: "text", text: args.message },
        { type: "text", text: `(${MODE_NOTE[args.mode]})` },
      ],
    },
  ];
  const usage = { inputTokens: 0, outputTokens: 0 };
  let servedBy = model;

  const step = async (allowTools: boolean) => {
    const t0 = Date.now();
    const response = await getClient().beta.messages.create({
      model,
      max_tokens: 16000,
      system: [{ type: "text", text: SYSTEM_PROMPT_WITH_KNOWLEDGE, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      tool_choice: allowTools ? { type: "auto" } : { type: "none" },
      messages,
      output_config: { effort: config.anthropic.effort },
      ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    servedBy = response.model;
    usage.inputTokens += response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0);
    usage.outputTokens += response.usage.output_tokens;
    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    ctx.trace.push({
      kind: "llm",
      name: `Claude · ${response.model}`,
      summary: `${toolUses.length ? `planned ${toolUses.length} tool call(s)` : "wrote the answer"} · cache read ${response.usage.cache_read_input_tokens ?? 0} tokens`,
      ms: Date.now() - t0,
      ok: response.stop_reason !== "refusal",
    });
    // Append the full content (thinking blocks included) unchanged.
    messages.push({ role: "assistant", content: response.content });
    return { response, toolUses, text };
  };

  let reply = "";
  for (let turn = 0; turn < config.agent.maxTurns; turn++) {
    const { response, toolUses, text } = await step(true);
    if (response.stop_reason === "refusal") {
      reply = "Sorry, I can't help with that. Ask me about unlocks, news or market odds for a token.";
      break;
    }
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      reply = text;
      break;
    }
    const results = await Promise.all(
      toolUses.map(async (call): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        const out = await executeTool(call.name, call.input, ctx);
        return { type: "tool_result", tool_use_id: call.id, content: out.content, is_error: out.isError };
      }),
    );
    messages.push({ role: "user", content: results });
  }
  if (!reply) reply = (await step(false)).text;

  return {
    reply,
    get model() {
      return servedBy;
    },
    usage,
    rewrite: async (issues) => {
      messages.push({
        role: "user",
        content: `Rewrite your last answer. It broke these rules: ${issues.join("; ")}. Use only facts and numbers from the tool results, give no buy/sell/hold advice and no price predictions, and keep it to 5 short lines.`,
      });
      return (await step(false)).text;
    },
  };
}
