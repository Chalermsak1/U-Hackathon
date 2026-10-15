import { z } from "zod";
import { runAgent } from "@/lib/agent";
import { writeLog } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  message: z.string().trim().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
    .max(12)
    .optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "message is required (max 500 chars)" }, { status: 400 });
  try {
    return Response.json(await runAgent(parsed.data.message, parsed.data.history ?? []));
  } catch (err) {
    await writeLog({ type: "error", route: "/api/agent", message: (err as Error).message });
    return Response.json({ error: "U-Guard is unavailable right now. Try again." }, { status: 500 });
  }
}
