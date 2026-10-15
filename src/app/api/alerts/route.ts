import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/guard/rate-limit";
import { checkOrigin, checkPost, jsonError, tooMany } from "@/lib/http";
import { thb } from "@/lib/format";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// type: unlock (scheduled supply) · drift (wallet off the user's target mix) · news.
// symbol "*" means every non-stablecoin holding.
const Rule = z.object({
  type: z.enum(["unlock", "drift", "news"]).default("unlock"),
  symbol: z.string().trim().toUpperCase().regex(/^(\*|[A-Z0-9.\-]{1,20})$/).default("*"),
  minLevel: z.enum(["medium", "high"]).default("medium"),
  daysBefore: z.number().int().min(1).max(30).default(7),
  channel: z.enum(["ubot", "telegram", "line"]).default("ubot"),
});

// Smart alert rules (demo: kept in memory) and the protection decisions made so far, for the
// signed-in user only.
export async function GET() {
  const session = await getSession();
  if (!session) return jsonError(401, "Sign in to see your alerts.");
  return Response.json({
    rules: store.alerts.filter((r) => r.ownerId === session.sub),
    decisions: [
      ...[...store.proposals.values()]
        .filter((r) => r.ownerId === session.sub && r.proposal.status !== "pending")
        .map((r) => ({ ...r.proposal, receipt: r.receipt ?? null })),
      // Trade and invest plans the user decided on, in the same list.
      ...[...store.tradePlans.values()]
        .filter((r) => r.ownerId === session.sub && r.plan.status !== "pending")
        .map(({ plan }) => ({ id: plan.id, symbol: plan.symbol, title: `${plan.side === "buy" ? "Buy" : "Sell"} plan ${thb(plan.amountThb)} (paper)`, status: plan.status })),
      ...[...store.investPlans.values()]
        .filter((r) => r.ownerId === session.sub && r.plan.status !== "pending")
        .map(({ plan }) => ({ id: plan.id, symbol: "Portfolio", title: `"${plan.profileName}" investment plan · DCA ${thb(plan.monthlyThb)}/month`, status: plan.status })),
    ],
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
  const data = parsed.data.type === "drift" ? { ...parsed.data, symbol: "*" } : parsed.data;
  // One drift rule per user is enough; adding it again just returns the existing one.
  const dup = store.alerts.find((r) => r.ownerId === session.sub && (r.type ?? "unlock") === data.type && r.symbol === data.symbol && r.minLevel === data.minLevel && r.daysBefore === data.daysBefore);
  if (dup) return Response.json(dup, { status: 200 });
  const rule = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ownerId: session.sub, ...data };
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
