// U-Guard as an MCP server: the integration surface for U-Bot (or any MCP-capable
// orchestrator). Same tools, validation and trace as the in-app agent.
// Streamable HTTP, stateless, JSON responses: one Server + transport per request.

import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TOOL_SPECS, executeTool, newContext } from "./agent/tools";
import { now } from "./config";
import { logEvent } from "./log";

const INSTRUCTIONS =
  "U-Guard checks what could move a user's money before they act: token unlock risk (Tokenomist), news, prediction-market odds and market pulse. " +
  "Call assess_unlock_risk before a swap, buy or DCA. Results are information, not investment advice. " +
  "propose_protection only creates a proposal; the user must approve it in the app.";

export async function handleMcp(req: Request, opts: { clientId?: string } = {}): Promise<Response> {
  const server = new Server({ name: "u-guard", version: "0.2.0" }, { capabilities: { tools: {} }, instructions: INSTRUCTIONS });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_SPECS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const ctx = newContext({ userId: opts.clientId ?? "mcp-client", scope: "user", requestId: randomUUID(), now: now() });
    const out = await executeTool(request.params.name, request.params.arguments ?? {}, ctx);
    const step = ctx.trace.at(-1);
    logEvent("mcp.tool_call", { requestId: ctx.requestId, tool: request.params.name, ok: !out.isError, ms: step?.ms });
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
