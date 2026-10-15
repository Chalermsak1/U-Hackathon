import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Alert history and the last watch run, for /terminal/alerts.
export async function GET() {
  const last = store.lastWatch;
  return Response.json({
    events: store.alertEvents.slice(0, 50),
    last: last ? { ...last, result: last.result ? { reply: last.result.reply, mode: last.result.mode } : null } : null,
  });
}
