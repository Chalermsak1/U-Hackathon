import { z } from "zod";
import { runAgent } from "@/lib/agent";
import { config } from "@/lib/config";
import { getUBot } from "@/lib/ubot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ userId: z.string().min(1).max(100), text: z.string().trim().min(1).max(500) });

// Inbound from U-Bot. When UBOT_API_KEY is set, callers must send it as a Bearer token.
export async function POST(req: Request) {
  if (config.ubot.apiKey && req.headers.get("authorization") !== `Bearer ${config.ubot.apiKey}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "userId and text are required" }, { status: 400 });
  const result = await runAgent(parsed.data.text, [], "/api/ubot/webhook");
  await getUBot().send(parsed.data.userId, "reply", result);
  return Response.json(result);
}
