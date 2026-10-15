import { endSession } from "@/lib/auth/session";
import { checkPost } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const blocked = checkPost(req);
  if (blocked) return blocked;
  await endSession();
  return Response.json({ ok: true });
}
