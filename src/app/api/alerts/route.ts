import { z } from "zod";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Rule = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,20}$/),
  minLevel: z.enum(["medium", "high"]),
  daysBefore: z.number().int().min(1).max(30),
  channel: z.enum(["ubot", "telegram", "line"]),
});

// Smart alert rules (demo: kept in memory) and the protection decisions made so far.
export async function GET() {
  return Response.json({
    rules: store.alerts,
    decisions: [...store.proposals.values()].filter((p) => p.status !== "pending"),
  });
}

export async function POST(req: Request) {
  const parsed = Rule.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "symbol, minLevel, daysBefore (1-30) and channel are required" }, { status: 400 });
  const rule = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...parsed.data };
  store.alerts.unshift(rule);
  store.alerts.splice(50);
  return Response.json(rule, { status: 201 });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const i = store.alerts.findIndex((r) => r.id === id);
  if (i < 0) return Response.json({ error: "not found" }, { status: 404 });
  store.alerts.splice(i, 1);
  return new Response(null, { status: 204 });
}
