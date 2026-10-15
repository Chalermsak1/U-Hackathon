import { readFixture } from "@/lib/fixtures";
import { trackedTokens } from "@/lib/tokenomist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScreenerFile {
  source: string;
  asOf: string;
  rows: {
    symbol: string;
    leadInvestors: string | null;
    totalInvestors: number | null;
    latestRound: string | null;
    marketCap: number;
    fdv: number;
    totalRaised: number | null;
    unlockedInvestorsUsd: number | null;
    pctInvestorsUnlocked: number | null;
  }[];
}

// Supply screener: Tokenomist fundraising screener rows plus float (MCAP ÷ FDV). Rows for
// tokens U-Guard has full unlock data on are flagged `analysed` so the UI can link them.
export async function GET() {
  const [file, tracked] = await Promise.all([readFixture<ScreenerFile>("screener.json"), trackedTokens()]);
  const analysed = new Set(tracked.data.map((t) => t.symbol));
  const rows = (file?.rows ?? []).map((r) => ({
    ...r,
    floatPct: r.fdv > 0 ? (r.marketCap / r.fdv) * 100 : null,
    analysed: analysed.has(r.symbol),
  }));
  return Response.json({ rows, source: file?.source ?? "", asOf: file?.asOf ?? "" });
}
