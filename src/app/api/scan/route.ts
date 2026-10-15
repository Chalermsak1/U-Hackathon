import { runAgent } from "@/lib/agent";
import { writeLog } from "@/lib/log";
import { getUBot } from "@/lib/ubot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEMO_USER = "demo-user";

// Daily "holding watch": scan the portfolio and push an alert through U-Bot when any
// holding has a medium or high unlock risk coming.
export async function POST() {
  try {
    const result = await runAgent("สแกนพอร์ตของฉัน หาเหรียญที่มี unlock ใน 30 วันข้างหน้า", [], "/api/scan");
    const risky = result.cards.some((c) => c.level === "high" || c.level === "medium");
    if (risky) await getUBot().send(DEMO_USER, "alert", result);
    return Response.json({ ...result, pushed: risky });
  } catch (err) {
    await writeLog({ type: "error", route: "/api/scan", message: (err as Error).message });
    return Response.json({ error: "Scan failed. Try again." }, { status: 500 });
  }
}
