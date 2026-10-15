import { z } from "zod";
import { ensureDefaultRules, store, type AlertRule } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Sym = z.string().trim().toUpperCase().regex(/^(\*|[A-Z0-9.\-]{1,20})$/);
const Channel = z.enum(["ubot", "telegram", "line"]);
const Rule = z.discriminatedUnion("type", [
  z.object({ type: z.literal("unlock"), symbol: Sym, minLevel: z.enum(["medium", "high"]), daysBefore: z.number().int().min(1).max(30), channel: Channel }),
  z.object({ type: z.literal("drift"), bandPp: z.number().min(1).max(50), channel: Channel }),
  z.object({ type: z.literal("news"), symbol: Sym, minSeverity: z.enum(["medium", "high"]), channel: Channel }),
]);

// Alert rules (demo: in memory) and the protection decisions made so far.
export async function GET() {
  return Response.json({
    rules: ensureDefaultRules(),
    decisions: [...store.proposals.values()].filter((p) => p.status !== "pending"),
  });
}

export async function POST(req: Request) {
  const parsed = Rule.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "invalid rule" }, { status: 400 });
  const rule = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...parsed.data } as AlertRule;
  ensureDefaultRules();
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
