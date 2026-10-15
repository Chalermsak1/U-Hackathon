import { z } from "zod";
import { getTargets, setTargets } from "@/lib/drift";

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
  }, "targets must add up to 100% (or all 0 to clear them)");

// The user's own target mix. Drift is measured against this, never against our opinion.
export async function GET() {
  return Response.json(await getTargets());
}

export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "invalid targets" }, { status: 400 });
  const targets = Object.fromEntries(Object.entries(parsed.data.targets).filter(([, v]) => v > 0));
  setTargets({ targets, bandPp: parsed.data.bandPp });
  return Response.json(await getTargets());
}
