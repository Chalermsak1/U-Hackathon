import { getSession, publicUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  return Response.json({ user: session ? publicUser(session) : null }, { headers: { "cache-control": "no-store" } });
}
