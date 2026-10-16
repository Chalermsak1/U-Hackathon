import { brokerName } from "@/lib/broker";
import { config, now } from "@/lib/config";
import { getQuote } from "@/lib/market";
import { sharedStoreEnabled } from "@/lib/store";
import { listTokens } from "@/lib/tokenomist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Where each piece of data comes from right now, so "why isn't it updating?" has an answer.
// Booleans and modes only: never a key or its length.
export async function GET() {
  const [tokens, arb] = await Promise.all([listTokens(), getQuote("ARB")]);
  return Response.json({
    now: new Date(now()).toISOString(),
    clockFrozen: Boolean(process.env.DEMO_NOW),
    tokenomist: {
      keySet: Boolean(config.tokenomist.apiKey),
      mode: tokens.source,
      tokens: tokens.data.length,
      asOf: tokens.asOf,
      problem: tokens.warning ?? null,
    },
    prices: { setting: config.market.source, mode: arb?.source ?? null, asOf: arb?.asOf ?? null, stale: arb?.stale ?? false },
    news: config.intel.news,
    odds: config.intel.odds,
    agent: config.agent.provider,
    sharedStore: sharedStoreEnabled,
    broker: brokerName(),
  });
}
