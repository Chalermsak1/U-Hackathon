import { issueNonce } from "@/lib/auth/session";
import { newNonce } from "@/lib/auth/siwe";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { anonId, tooMany } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = rateLimit(`auth:nonce:${anonId(req)}`, 30, LIMITS.auth.windowMs);
  if (!limit.ok) return tooMany(limit);
  const nonce = newNonce();
  await issueNonce(nonce);
  return Response.json({ nonce }, { headers: { "cache-control": "no-store" } });
}
