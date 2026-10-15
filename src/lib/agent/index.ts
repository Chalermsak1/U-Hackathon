// The agent harness: the loop we own, whatever model runs inside it.
//
//   1. Guard     input guard (secrets blocked, PII redacted, injection flagged)
//   2. Plan+Act  an LLM tool loop (OpenAI-compatible or Anthropic) or the rules planner;
//                every tool goes through executeTool() → validation + trace + citations
//   3. Reflect   compliance check on the reply → one LLM rewrite → template fallback
//   4. Observe   trace steps, timings, token usage and a structured log line per request
//
// Any LLM failure falls back to the rules engine, so the demo never goes silent.

import { randomUUID } from "node:crypto";
import { config, now as clockNow } from "../config";
import { guardInput, sanitizeHistory } from "../guard/input";
import { KNOWLEDGE_BLOCK } from "../knowledge";
import { logEvent } from "../log";
import type { AgentProvider, AgentResult, AnswerMode, ComplianceReport } from "../types";
import { checkReply } from "./compliance";
import { anthropicConfigured, runAnthropic } from "./providers/anthropic";
import { openAIConfigured, runOpenAICompatible, type LlmRun } from "./providers/openai-compatible";
import { composeReply, makePlan, planFromContext, runRules } from "./providers/rules";
import { newContext, type RunContext } from "./tools";

export function activeProvider(): { provider: AgentProvider; label: string; model: string | null } {
  const wanted = config.agent.provider;
  if ((wanted === "openai" || wanted === "auto") && openAIConfigured()) {
    return { provider: "openai", label: config.llm.label, model: config.llm.model };
  }
  if ((wanted === "anthropic" || wanted === "auto") && anthropicConfigured()) {
    return { provider: "anthropic", label: "Claude", model: config.anthropic.model };
  }
  return { provider: "rules", label: "Rules engine", model: null };
}

export interface AgentRequest {
  message: unknown;
  history?: unknown;
  mode?: unknown;
  userId: string;
  scope: "user" | "public";
  now?: number;
}

export async function runAgent(req: AgentRequest): Promise<AgentResult> {
  const t0 = Date.now();
  const requestId = randomUUID();
  const mode: AnswerMode = req.mode === "pro" ? "pro" : "beginner";
  const nowMs = req.now ?? clockNow();
  let ctx: RunContext = newContext({ userId: req.userId, scope: req.scope, requestId, now: nowMs });

  // ─── 1. Guard ───
  const g0 = Date.now();
  const guard = guardInput(req.message);
  const history = sanitizeHistory(req.history);
  const guardNotes = [...guard.flags, ...guard.redactions.map((r) => `redacted ${r}`)];
  ctx.trace.push({
    kind: "guard",
    name: "input_guard",
    summary: guard.blocked ? `blocked: ${guard.flags[0] ?? "empty message"}` : guardNotes.join(" · ") || "clean",
    ms: Date.now() - g0,
    ok: !guard.blocked,
  });

  const finish = (partial: { reply: string; provider: AgentProvider; model: string | null; compliance: ComplianceReport; note?: string; usage?: AgentResult["usage"] }): AgentResult => {
    const result: AgentResult = {
      requestId,
      reply: partial.reply,
      cards: [...ctx.cards.values()],
      news: ctx.news,
      odds: ctx.odds,
      pulse: ctx.pulse,
      calendar: ctx.calendar,
      proposals: ctx.proposals,
      trace: ctx.trace,
      citations: ctx.citations,
      provider: partial.provider,
      model: partial.model,
      compliance: partial.compliance,
      note: partial.note,
      usage: partial.usage,
      ms: Date.now() - t0,
      now: new Date(nowMs).toISOString(),
    };
    logEvent("agent.reply", {
      requestId,
      userId: req.userId,
      scope: req.scope,
      provider: result.provider,
      model: result.model,
      ms: result.ms,
      tools: ctx.trace.filter((s) => s.kind === "tool").map((s) => s.name),
      failedSteps: ctx.trace.filter((s) => !s.ok).length,
      compliance: result.compliance.status,
      usage: result.usage,
      flags: guard.flags,
    });
    return result;
  };

  if (guard.blocked) {
    return finish({ reply: guard.blockReason ?? "Message blocked.", provider: "rules", model: null, compliance: { status: "pass", issues: [] } });
  }

  // ─── 2. Plan + act ───
  const chosen = activeProvider();
  let provider: AgentProvider = chosen.provider;
  let model: string | null = chosen.model;
  let reply = "";
  let note: string | undefined;
  let llm: LlmRun | null = null;

  if (provider !== "rules") {
    try {
      const args = { message: guard.text, history, mode, ctx };
      llm = provider === "openai" ? await runOpenAICompatible(args) : await runAnthropic(args);
      reply = llm.reply;
      model = llm.model;
    } catch (err) {
      const message = (err as Error).message.slice(0, 160);
      note = `${chosen.label} was unavailable, so the rules engine answered.`;
      logEvent("agent.llm_error", { requestId, provider, error: message });
      const failed = [...ctx.trace, { kind: "llm" as const, name: chosen.label, summary: `failed: ${message}`, ms: 0, ok: false }];
      ctx = newContext({ userId: req.userId, scope: req.scope, requestId, now: nowMs });
      ctx.trace.push(...failed);
      provider = "rules";
      model = null;
      llm = null;
    }
  }
  if (provider === "rules") {
    reply = (await runRules(guard.text, history, mode, ctx)).reply;
  }

  // ─── 3. Reflect ───
  const r0 = Date.now();
  const evidence = [...ctx.evidence, KNOWLEDGE_BLOCK];
  const opts = { userMessage: guard.text, sampleUsed: ctx.sources.has("sample") };
  let check = checkReply(reply, evidence, opts);
  const issues = [...check.issues];
  let status: ComplianceReport["status"] = check.ok ? (check.fixed ? "fixed" : "pass") : "pass";

  if (!check.ok && llm) {
    try {
      const second = checkReply(await llm.rewrite(check.issues), evidence, opts);
      if (second.ok) {
        check = second;
        status = "rewritten";
      }
    } catch (err) {
      logEvent("agent.rewrite_error", { requestId, error: (err as Error).message.slice(0, 160) });
    }
  }
  if (!check.ok) {
    const plan = planFromContext(ctx, await makePlan(guard.text));
    check = checkReply(composeReply(ctx, plan, mode), evidence, opts);
    status = "replaced";
  }
  ctx.trace.push({
    kind: "reflect",
    name: "compliance_check",
    summary:
      status === "pass"
        ? "no advice language · every number traced to a tool result"
        : status === "fixed"
          ? "added the sample-data label"
          : `${status === "rewritten" ? "rewrote" : "replaced with template"}: ${issues[0] ?? ""}`,
    ms: Date.now() - r0,
    ok: true,
  });

  return finish({
    reply: check.reply,
    provider,
    model,
    compliance: { status, issues },
    note,
    usage: llm?.usage,
  });
}
