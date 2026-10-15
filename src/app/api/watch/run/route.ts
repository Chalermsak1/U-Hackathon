import { config } from "@/lib/config";
import { writeLog } from "@/lib/log";
import { store } from "@/lib/store";
import { runWatch } from "@/lib/watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN_GAP_MS = 15_000;

async function run(trigger: "cron" | "manual") {
  const last = store.lastWatch;
  if (last && Date.now() - new Date(last.ranAt).getTime() < MIN_GAP_MS) {
    return Response.json({ ...last, throttled: true }, { status: 429 });
  }
  try {
    return Response.json(await runWatch(trigger));
  } catch (err) {
    await writeLog({ type: "error", route: "/api/watch/run", message: (err as Error).message });
    return Response.json({ error: "Watch run failed. Try again." }, { status: 500 });
  }
}

// Vercel Cron calls GET with "Authorization: Bearer $CRON_SECRET" (vercel.json).
export async function GET(req: Request) {
  if (config.watch.cronSecret && req.headers.get("authorization") !== `Bearer ${config.watch.cronSecret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return run("cron");
}

// The "ตรวจตอนนี้" button. Demo only: add auth before any public deployment.
export async function POST() {
  return run("manual");
}
