import { publicUser, startSession, takeNonce } from "@/lib/auth/session";
import { verifySiwe } from "@/lib/auth/siwe";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { anonId, checkPost, handleError, jsonError, readJson, tooMany } from "@/lib/http";
import { logEvent } from "@/lib/log";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const blocked = checkPost(req);
  if (blocked) return blocked;
  try {
    const limit = rateLimit(`auth:wallet:${anonId(req)}`, LIMITS.auth.max, LIMITS.auth.windowMs);
    if (!limit.ok) return tooMany(limit);
    const body = await readJson<{ message?: unknown; signature?: unknown }>(req, 4096);
    if (typeof body.message !== "string" || typeof body.signature !== "string") return jsonError(400, "Missing message or signature.");
    const result = await verifySiwe({
      message: body.message,
      signature: body.signature,
      nonce: await takeNonce(),
      host: req.headers.get("host") ?? "",
    });
    if ("error" in result) {
      logEvent("auth.wallet_failed", { reason: result.error });
      return jsonError(401, result.error);
    }
    const address = result.address;
    const session = await startSession({
      sub: `wallet:${address.toLowerCase()}`,
      name: `${address.slice(0, 6)}…${address.slice(-4)}`,
      address,
      method: "wallet",
    });
    logEvent("auth.login", { userId: session.sub, method: "wallet" });
    return Response.json({ user: publicUser(session) });
  } catch (err) {
    return handleError(err);
  }
}
