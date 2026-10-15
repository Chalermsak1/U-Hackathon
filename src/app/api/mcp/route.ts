import { timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { anonId, jsonError, tooMany } from "@/lib/http";
import { handleMcp, mcpCaller } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Auth = { ok: false; res: Response } | { ok: true; trusted: boolean };

// MCP endpoint for U-Bot (Streamable HTTP). Auth: `Authorization: Bearer $MCP_API_KEY`.
// Without MCP_API_KEY it is open in development and disabled in production. Only a caller that
// presented the key is "trusted", and only a trusted caller may act for a user (X-UGuard-User).
function authorize(req: Request): Auth {
  const origin = req.headers.get("origin");
  if (origin) {
    // DNS-rebinding protection: browsers may only call this from our own origin.
    try {
      if (new URL(origin).host !== req.headers.get("host")) return { ok: false, res: jsonError(403, "Origin not allowed.") };
    } catch {
      return { ok: false, res: jsonError(403, "Bad origin.") };
    }
  }
  const key = config.mcp.apiKey;
  if (!key) return config.isProd ? { ok: false, res: jsonError(503, "MCP is disabled: set MCP_API_KEY.") } : { ok: true, trusted: false };
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(key);
  return given.length === expected.length && timingSafeEqual(given, expected)
    ? { ok: true, trusted: true }
    : { ok: false, res: jsonError(401, "Invalid MCP token.") };
}

async function handle(req: Request): Promise<Response> {
  const auth = authorize(req);
  if (!auth.ok) return auth.res;
  const limit = rateLimit(`mcp:${anonId(req)}`, LIMITS.mcp.max, LIMITS.mcp.windowMs);
  if (!limit.ok) return tooMany(limit);
  return handleMcp(req, mcpCaller(req, auth.trusted, `mcp:${anonId(req)}`));
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
