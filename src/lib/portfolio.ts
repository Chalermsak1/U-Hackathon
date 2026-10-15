// The user's U-topia wallet. Holdings come from the demo fixture (U-topia has no public
// wallet API yet); AVAX is replaced by the live Fuji balance when WALLET_ADDRESS is set.

import { getAvaxBalance } from "./avalanche";
import { config } from "./config";
import { readFixture } from "./fixtures";
import { getQuote, usdToThb } from "./market";
import { listTokens } from "./tokenomist";
import type { Holding } from "./types";

interface PortfolioFixture {
  holdings: { symbol: string; amount: number }[];
}

const NAMES: Record<string, string> = { USDC: "USD Coin", USDT: "Tether", BTC: "Bitcoin", ETH: "Ethereum" };

export async function getHoldings(): Promise<Holding[]> {
  const [fixture, fx, tokens] = await Promise.all([
    readFixture<PortfolioFixture>("portfolio.json"),
    usdToThb(),
    listTokens(),
  ]);
  const rows = fixture?.holdings ?? [];
  const liveAvax = config.avalanche.walletAddress ? await getAvaxBalance(config.avalanche.walletAddress) : null;

  return Promise.all(
    rows.map(async (row): Promise<Holding> => {
      const isLiveAvax = row.symbol === "AVAX" && liveAvax !== null;
      const amount = isLiveAvax ? liveAvax : row.amount;
      const quote = await getQuote(row.symbol);
      const priceUsd = quote?.priceUsd ?? 0;
      const name = tokens.data.find((t) => t.symbol === row.symbol)?.name ?? NAMES[row.symbol] ?? row.symbol;
      return {
        symbol: row.symbol,
        name,
        amount,
        priceUsd,
        valueUsd: amount * priceUsd,
        valueThb: amount * priceUsd * fx,
        source: isLiveAvax ? "live" : "sample",
      };
    }),
  );
}
