import { now } from "@/lib/config";
import { marketScreen } from "@/lib/screener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Market screener: top tokens by market cap with live prices and the next Tokenomist unlock.
export async function GET() {
  return Response.json(await marketScreen(now()));
}
