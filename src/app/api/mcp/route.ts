import { timingSafeEqual } from "node:crypto";
import { config } from "@/lib/config";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { anonId, jsonError, tooMany } from "@/lib/http";
import { handleMcp } from "@/lib/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// MCP endpoint for U-Bot (Streamable HTTP). Auth: `Authorization: Bearer $MCP_API_KEY`.
// Without MCP_API_KEY it is open in development and disabled in production.
function authorize(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (origin) {
    // DNS-rebinding protection: browsers may only call this from our own origin.
    try {
      if (new URL(origin).host !== req.headers.get("host")) return jsonError(403, "Origin not allowed.");
    } catch {
      return jsonError(403, "Bad origin.");
    }
  }
  const key = config.mcp.apiKey;
  if (!key) return config.isProd ? jsonError(503, "MCP is disabled: set MCP_API_KEY.") : null;
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(key);
  return given.length === expected.length && timingSafeEqual(given, expected) ? null : jsonError(401, "Invalid MCP token.");
}

async function handle(req: Request): Promise<Response> {
  const denied = authorize(req);
  if (denied) return denied;
  const limit = rateLimit(`mcp:${anonId(req)}`, LIMITS.mcp.max, LIMITS.mcp.windowMs);
  if (!limit.ok) return tooMany(limit);
  return handleMcp(req, { clientId: `mcp:${anonId(req)}` });
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
