import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { checkDrift, getTargets, setTargets } from "@/lib/drift";
import { now } from "@/lib/config";
import { checkOrigin, jsonError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z
  .object({
    targets: z.record(z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,20}$/), z.number().min(0).max(100)),
    bandPp: z.number().min(1).max(50),
  })
  .refine((b) => {
    const sum = Object.values(b.targets).reduce((s, v) => s + v, 0);
    return sum === 0 || Math.abs(sum - 100) <= 1;
  }, "เป้าสัดส่วนต้องรวมกันได้ 100% (หรือใส่ 0 ทั้งหมดเพื่อล้างเป้า)");

// The signed-in user's own target mix and the drift report against it. Drift is measured against
// this plan, never against our opinion.
export async function GET() {
  const session = await getSession();
  if (!session) return jsonError(401, "Sign in to see your targets.");
  const [targets, drift] = await Promise.all([getTargets(session.sub), checkDrift(session.sub, { now: now(), locale: "th" })]);
  return Response.json({ ...targets, drift });
}

export async function PUT(req: Request) {
  const blocked = checkOrigin(req);
  if (blocked) return blocked;
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return jsonError(415, "JSON body required.");
  const session = await getSession();
  if (!session) return jsonError(401, "Sign in to set targets.");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "invalid targets");
  const targets = Object.fromEntries(Object.entries(parsed.data.targets).filter(([, v]) => v > 0));
  setTargets(session.sub, { targets, bandPp: parsed.data.bandPp });
  const drift = await checkDrift(session.sub, { now: now(), locale: "th" });
  return Response.json({ ...(await getTargets(session.sub)), drift });
}
