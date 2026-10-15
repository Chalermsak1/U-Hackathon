// U-Bot stand-in: a real MCP client that calls U-Guard the way U-Bot would before it moves a
// user's money. U-Bot's own interface isn't public yet, so this plays its part on stage.
//
//   npm run ubot                                  # English, ARB, ฿5,000, Enter between steps
//   npm run ubot -- --symbol AVAX --thb 2000      # another token
//   npm run ubot -- --auto                        # no pauses (rehearsal, video)
//   npm run ubot -- --url https://<host>/api/mcp  # a deployed server
//
// Reads MCP_API_KEY from .env (the server must use the same key). With the key, U-Bot acts for
// the user in --user (default demo-user): the proposal it creates lands in that user's U-Bot
// inbox (the bell in the app), where they approve it. Without the key the server treats us as
// an anonymous client and nothing reaches a user.

import readline from "node:readline/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env: rely on the environment
}

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const url = opt("url", process.env.MCP_URL || `http://localhost:${process.env.PORT || 3000}/api/mcp`);
const user = opt("user", "demo-user");
const symbol = opt("symbol", "ARB").toUpperCase();
const thb = Number(opt("thb", "5000"));
const lang = opt("lang", "en");
const auto = args.includes("--auto");
const key = process.env.MCP_API_KEY;

const c = { dim: "\x1b[2m", bold: "\x1b[1m", teal: "\x1b[36m", amber: "\x1b[33m", red: "\x1b[31m", green: "\x1b[32m", off: "\x1b[0m" };
const LEVEL_COLOR = { high: c.red, medium: c.amber, low: c.green, none: c.dim };
const rl = auto ? null : readline.createInterface({ input: process.stdin, output: process.stdout });

async function step(title) {
  console.log(`\n${c.bold}${title}${c.off}`);
  if (rl) await rl.question(`${c.dim}  (Enter)${c.off}`);
}
function sent(method, params) {
  console.log(`${c.teal}  U-Bot → U-Guard${c.off}  ${method}${params ? ` ${c.dim}${JSON.stringify(params)}${c.off}` : ""}`);
}
function parse(result) {
  try {
    return JSON.parse(result.content?.[0]?.text ?? "{}");
  } catch {
    return {};
  }
}

console.log(`${c.bold}U-Bot (stand-in) · MCP client${c.off}`);
console.log(`${c.dim}  server ${url}\n  acting for ${key ? user : "nobody (no MCP_API_KEY: anonymous client)"}${c.off}`);
console.log(`\n  Scenario: the user asks U-Bot to buy ${symbol} for ฿${thb.toLocaleString("en-US")}. Before any money moves, U-Bot asks U-Guard.`);

const headers = { "x-uguard-locale": lang };
if (key) {
  headers.authorization = `Bearer ${key}`;
  headers["x-uguard-user"] = user;
}
const client = new Client({ name: "u-bot-standin", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers } });

try {
  await step("1 · Connect over MCP");
  sent("initialize");
  await client.connect(transport);
  const info = client.getServerVersion();
  console.log(`  ← connected to ${c.bold}${info?.name} ${info?.version}${c.off}`);

  await step("2 · What can U-Guard do?");
  sent("tools/list");
  const { tools } = await client.listTools();
  console.log(`  ← ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);

  await step(`3 · Check ${symbol} before buying`);
  const assessArgs = { symbol, trade_amount_thb: thb };
  sent("tools/call assess_unlock_risk", assessArgs);
  const risk = parse(await client.callTool({ name: "assess_unlock_risk", arguments: assessArgs }));
  if (risk.rated === false) {
    console.log(`  ← ${risk.note}`);
  } else {
    const color = LEVEL_COLOR[risk.level] ?? "";
    console.log(`  ← ${color}${c.bold}${String(risk.level).toUpperCase()} ${risk.score}/100${c.off}  (${risk.timing}${risk.unlock_date ? `, ${risk.unlock_date}` : ""})`);
    for (const r of (risk.reasons ?? []).slice(0, 3)) console.log(`     · ${r}`);
    console.log(`     ${c.dim}data: Tokenomist ${risk.data}${c.off}`);
  }

  if (risk.level === "high" || risk.level === "medium") {
    await step("4 · Propose a protection rule (the user decides)");
    const proposeArgs = { symbol, action: "pause_buying" };
    sent("tools/call propose_protection", proposeArgs);
    const proposal = parse(await client.callTool({ name: "propose_protection", arguments: proposeArgs }));
    if (proposal.created) {
      console.log(`  ← proposal ${c.bold}${proposal.title}${c.off}`);
      console.log(`     ${c.dim}id ${proposal.proposal_id} · status ${proposal.status}${c.off}`);
      console.log(
        key
          ? `\n  ${c.green}Delivered to ${user}'s U-Bot inbox.${c.off} Open the app → bell → "Approve" → receipt on Avalanche.`
          : `\n  ${c.amber}No MCP_API_KEY: the proposal belongs to an anonymous client and reaches no user.${c.off}`,
      );
    } else {
      console.log(`  ← not created: ${proposal.note ?? "unknown reason"}`);
    }
  } else {
    console.log(`\n  ${c.green}Nothing to protect: U-Bot can go ahead.${c.off} (Calm when it's safe: no alert, no proposal.)`);
  }
  console.log(`\n${c.dim}Information only, not investment advice. Every action waits for the user's approval.${c.off}`);
} catch (err) {
  console.error(`\n${c.red}MCP call failed:${c.off} ${err.message}`);
  if (/401/.test(err.message)) console.error("  The server and this script need the same MCP_API_KEY.");
  if (/503/.test(err.message)) console.error("  The server runs in production without MCP_API_KEY, so MCP is off. Set it and restart.");
  if (/ECONNREFUSED|fetch failed/.test(err.message)) console.error(`  Is the app running at ${url}?`);
  process.exitCode = 1;
} finally {
  rl?.close();
  await client.close().catch(() => undefined);
}
