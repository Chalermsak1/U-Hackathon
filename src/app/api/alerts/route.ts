import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { checkOrigin, checkPost, jsonError, tooMany } from "@/lib/http";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Rule = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9.\-]{1,20}$/),
  minLevel: z.enum(["medium", "high"]),
  daysBefore: z.number().int().min(1).max(30),
  channel: z.enum(["ubot", "telegram", "line"]),
});

// Smart alert rules (demo: kept in memory) and the protection decisions made so far, for the
// signed-in user only.
export async function GET() {
  const session = await getSession();
  if (!session) return jsonError(401, "Sign in to see your alerts.");
  return Response.json({
    rules: store.alerts.filter((r) => r.ownerId === session.sub),
    decisions: [...store.proposals.values()]
      .filter((r) => r.ownerId === session.sub && r.proposal.status !== "pending")
      .map((r) => ({ ...r.proposal, receipt: r.receipt ?? null })),
  });
}

export async function POST(req: Request) {
  const blocked = checkPost(req);
  if (blocked) return blocked;
  const session = await getSession();
  if (!session) return jsonError(401, "Sign in to add alerts.");
  const limit = rateLimit(`alerts:${session.sub}`, LIMITS.alerts.max, LIMITS.alerts.windowMs);
  if (!limit.ok) return tooMany(limit);
  const parsed = Rule.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "symbol, minLevel, daysBefore (1-30) and channel are required");
  const rule = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ownerId: session.sub, ...parsed.data };
  store.alerts.unshift(rule);
  store.alerts.splice(200);
  return Response.json(rule, { status: 201 });
}

export async function DELETE(req: Request) {
  const blocked = checkOrigin(req);
  if (blocked) return blocked;
  const session = await getSession();
  if (!session) return jsonError(401, "Sign in to remove alerts.");
  const id = new URL(req.url).searchParams.get("id");
  const i = store.alerts.findIndex((r) => r.id === id && r.ownerId === session.sub);
  if (i < 0) return jsonError(404, "not found");
  store.alerts.splice(i, 1);
  return new Response(null, { status: 204 });
}
