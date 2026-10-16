import { getCandles, type Range } from "@/lib/candles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Price candles for one token (7d hourly, 30d 4-hourly, 90d daily).
export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  if (!/^[A-Za-z0-9]{1,12}$/.test(symbol)) return Response.json({ error: "Unknown token." }, { status: 400 });
  const r = new URL(req.url).searchParams.get("range");
  const range: Range = r === "7d" || r === "90d" ? r : "30d";
  return Response.json({ range, ...(await getCandles(symbol, range)) });
}
