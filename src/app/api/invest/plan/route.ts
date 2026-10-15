import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { now } from "@/lib/config";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { checkPost, handleError, jsonError, tooMany } from "@/lib/http";
import { writeLog } from "@/lib/log";
import { draftInvestPlan } from "@/lib/invest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Input = z.object({
  answers: z.array(z.number().int().min(1).max(4)).length(5),
  lumpSumThb: z.number().finite().min(0).max(100_000_000),
  monthlyThb: z.number().finite().min(0).max(10_000_000),
  dcaDay: z.number().int().min(1).max(28).default(25),
  weights: z.record(z.string().regex(/^[a-z_]{1,20}$/), z.number().finite().min(0).max(100)).optional(),
  cryptoPicks: z.array(z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,10}$/)).max(5).optional(),
});

// Draft an invest plan: profile from the five answers, the model portfolio (or the user's own
// weights), U-Guard's checks on the crypto part and the DCA dates.
export async function POST(req: Request) {
  const blocked = checkPost(req);
  if (blocked) return blocked;
  try {
    const session = await getSession();
    if (!session) return jsonError(401, "Sign in to draft an invest plan.");
    const limit = rateLimit(`invest:${session.sub}`, LIMITS.agent.max, LIMITS.agent.windowMs);
    if (!limit.ok) return tooMany(limit);
    const parsed = Input.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(400, "ตอบแบบประเมินให้ครบ 5 ข้อ และใส่จำนวนเงิน");
    if (parsed.data.lumpSumThb + parsed.data.monthlyThb <= 0) return jsonError(400, "ใส่เงินก้อนหรือเงิน DCA อย่างน้อยหนึ่งอย่าง");
    const plan = await draftInvestPlan(parsed.data, session.sub, now());
    return Response.json(plan);
  } catch (err) {
    await writeLog({ type: "error", route: "/api/invest/plan", message: (err as Error).message });
    return handleError(err);
  }
}
