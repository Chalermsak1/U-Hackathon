import { runAgent } from "@/lib/agent";
import { getSession } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { anonId, checkPost, handleError, jsonError, readJson, tooMany } from "@/lib/http";
import { writeLog } from "@/lib/log";
import { getUBot } from "@/lib/ubot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROMPT = {
  en: "Scan my portfolio",
  th: "สแกนพอร์ตของฉัน หาเหรียญที่มี unlock ใน 30 วันข้างหน้า",
};

// Holding watch (Flow B): the same agent, asked to scan the wallet. When any holding has a
// medium or high unlock risk coming, U-Bot pushes an alert (mock inbox or webhook).
export async function POST(req: Request) {
  const blocked = checkPost(req, { allowEmptyBody: true });
  if (blocked) return blocked;
  try {
    const session = await getSession();
    if (!session) return jsonError(401, "Sign in to scan your wallet.");
    const key = `scan:${session.sub}${session.method === "demo" ? `:${anonId(req)}` : ""}`;
    const limit = rateLimit(key, LIMITS.scan.max, LIMITS.scan.windowMs);
    if (!limit.ok) return tooMany(limit);
    const body = await readJson<{ mode?: unknown; lang?: unknown }>(req);
    const lang = body.lang === "th" ? "th" : "en";
    const result = await runAgent({ message: PROMPT[lang], mode: body.mode, userId: session.sub, scope: "user", route: "/api/scan" });
    const risky = result.cards.some((c) => c.level === "high" || c.level === "medium");
    if (risky) await getUBot().send(session.sub, "alert", result);
    return Response.json({ ...result, pushed: risky });
  } catch (err) {
    await writeLog({ type: "error", route: "/api/scan", message: (err as Error).message });
    return handleError(err);
  }
}
