// U-Guard as an MCP server: the integration surface for U-Bot (or any MCP-capable
// orchestrator). Same tools, validation and trace as the in-app agent.
// Streamable HTTP, stateless, JSON responses: one Server + transport per request.
//
// Acting for a user: a trusted caller (one holding MCP_API_KEY, i.e. U-Bot server to server)
// may name the user it is serving in `X-UGuard-User`. Tools then run as that user, and a
// proposal they create is delivered to that user's U-Bot inbox, where the user approves it.
// Until U-topia shares its spec, the header stands in for a delegated user token.

import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TOOL_SPECS, executeTool, newContext, type RunContext } from "./agent/tools";
import { now } from "./config";
import { logEvent } from "./log";
import type { AgentResult, Locale } from "./types";
import { getUBot } from "./ubot";

const INSTRUCTIONS =
  "U-Guard checks what could move a user's money before they act: token unlock risk (Tokenomist), news, prediction-market odds and market pulse. " +
  "Call assess_unlock_risk before a swap, buy or DCA. Results are information, not investment advice. " +
  "propose_protection only creates a proposal; the user must approve it in the app.";

const USER_ID = /^[A-Za-z0-9_.:@-]{1,64}$/;

export interface McpCaller {
  clientId?: string;
  /** The user a trusted caller is acting for; undefined for anonymous or untrusted callers. */
  userId?: string;
  locale?: Locale;
}

/** Reads the acting-for headers. `trusted` must be true only after the caller's key was verified. */
export function mcpCaller(req: Request, trusted: boolean, clientId?: string): McpCaller {
  const lang = req.headers.get("x-uguard-locale")?.trim().toLowerCase();
  const locale: Locale | undefined = lang === "th" || lang === "en" ? lang : undefined;
  const user = req.headers.get("x-uguard-user")?.trim();
  return { clientId, locale, userId: trusted && user && USER_ID.test(user) ? user : undefined };
}

/** What U-Bot found and proposed, as a message in the user's U-Bot inbox (the bell in the app). */
async function deliverToUser(userId: string, ctx: RunContext, t0: number): Promise<void> {
  const cards = [...ctx.cards.values()];
  const th = ctx.locale === "th";
  const lines = cards.map((c) =>
    th ? `U-Bot เช็ก ${c.symbol} กับ U-Guard ก่อนทำรายการ: ${c.reasons[0] ?? ""}` : `U-Bot checked ${c.symbol} with U-Guard before acting: ${c.reasons[0] ?? ""}`,
  );
  for (const p of ctx.proposals) lines.push(th ? `รอคุณอนุมัติ: ${p.title}` : `Waiting for your approval: ${p.title}`);
  const result: AgentResult = {
    requestId: ctx.requestId,
    reply: lines.join("\n"),
    cards,
    news: null,
    odds: null,
    pulse: null,
    calendar: null,
    proposals: ctx.proposals,
    trace: ctx.trace,
    citations: [],
    provider: "rules",
    model: null,
    // Fixed template built from the scorer's own reasons and the proposal copy: no model text.
    compliance: { status: "pass", issues: [] },
    note: th ? "ส่งมาจาก U-Bot ผ่าน MCP" : "Sent by U-Bot over MCP",
    ms: Date.now() - t0,
    now: new Date(ctx.now).toISOString(),
  };
  await getUBot().send(userId, "alert", result);
}

export async function handleMcp(req: Request, caller: McpCaller = {}): Promise<Response> {
  const server = new Server({ name: "u-guard", version: "0.3.0" }, { capabilities: { tools: {} }, instructions: INSTRUCTIONS });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_SPECS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const t0 = Date.now();
    const ctx = newContext({
      userId: caller.userId ?? caller.clientId ?? "mcp-client",
      scope: "user",
      requestId: randomUUID(),
      now: now(),
      locale: caller.locale,
    });
    const out = await executeTool(request.params.name, request.params.arguments ?? {}, ctx);
    const step = ctx.trace.at(-1);
    const delivered = Boolean(caller.userId && !out.isError && ctx.proposals.length > 0);
    if (delivered) await deliverToUser(caller.userId!, ctx, t0);
    logEvent("mcp.tool_call", {
      requestId: ctx.requestId,
      tool: request.params.name,
      ok: !out.isError,
      ms: step?.ms,
      actingFor: caller.userId,
      delivered,
    });
    return { content: [{ type: "text" as const, text: out.content }], isError: out.isError };
  });

  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}
