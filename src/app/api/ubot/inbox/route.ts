import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("userId") || "demo-user";
  return Response.json({ items: store.inbox.get(userId) ?? [] });
}
