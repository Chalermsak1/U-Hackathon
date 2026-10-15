// Tokenomist API v5 client (https://docs.tokenomist.ai/api-documents/introduction).
// Live when TOKENOMIST_API_KEY is set; on a missing key or any API error it reads the
// matching file under data/fixtures/tokenomist and marks the result as "sample".

import { config } from "./config";
import { readFixture } from "./fixtures";
import { TTL, makeFresh, type Freshness } from "./freshness";
import type { Sourced } from "./types";

// ─── Response shapes (subset of the v5 schema we use) ───────────────────────

export interface TokenListItem {
  id: string; // slug, used as tokenId in every other endpoint
  name: string;
  symbol: string;
  circulatingSupply: number;
  marketCap: number;
  maxSupply: number;
  totalLockedAmount: number;
  hasFundraising: boolean;
  latestFundraisingRound: string | null;
  websiteUrl: string;
  lastUpdatedDate: string;
}

export interface AllocationUnlock {
  unlockDate: string;
  allocationName: string;
  standardAllocationName: string;
  cliffAmount: number;
  cliffValue: number;
  referencePrice: number;
}

export interface UnlockEvent {
  unlockDate: string;
  tokenName: string;
  tokenSymbol: string;
  cliffUnlocks?: {
    cliffAmount: number;
    cliffValue: number;
    valueToMarketCap: number;
    allocationBreakdown: AllocationUnlock[];
  };
}

export interface AllocationsData {
  name: string;
  symbol: string;
  maxSupply: number;
  totalUnlockedAmount: number;
  totalLockedAmount: number;
  allocations: {
    allocationName: string;
    standardAllocationName: string;
    allocationUnlockedAmount: number;
    allocationLockedAmount: number;
    allocationAmount: number;
    trackedAllocationPercentage: number;
  }[];
}

export interface FundraisingData {
  tokenId: string;
  tokenSymbol: string;
  totalAmountRaised: number | null;
  investorReleasedPercentage: number | null;
  fundingRounds: {
    fundingRound: string;
    fundingDate: string;
    amountRaised: number | null;
    valuation: number | null;
    pricePerToken: number | null;
    numberOfInvestors: number | null;
  }[];
}

interface Envelope<T> {
  metadata?: { queryDate?: string };
  status: boolean;
  data: T;
}

// ─── Transport ──────────────────────────────────────────────────────────────

// Fresh copies are reused for their TTL. The last good live copy is kept separately, so
// when Tokenomist fails we can answer with it (marked stale) instead of dropping to the
// sample fixture.
const cache = new Map<string, { at: number; value: Sourced<unknown> }>();
const lastGood = new Map<string, Sourced<unknown>>();

async function fetchLive<T>(pathAndQuery: string): Promise<Envelope<T>> {
  const res = await fetch(`${config.tokenomist.baseUrl}${pathAndQuery}`, {
    headers: { "x-api-key": config.tokenomist.apiKey },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Tokenomist ${res.status} on ${pathAndQuery.split("?")[0]}`);
  }
  return (await res.json()) as Envelope<T>;
}

async function load<T>(
  cacheKey: string,
  livePath: string,
  fixturePath: string[],
  empty: T,
  ttlSeconds: number,
): Promise<Sourced<T>> {
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < ttlSeconds * 1000) return hit.value as Sourced<T>;

  const now = new Date().toISOString();
  let warning: string | undefined;
  if (config.tokenomist.apiKey) {
    try {
      const body = await fetchLive<T>(livePath);
      const value: Sourced<T> = {
        data: body.data,
        source: "live",
        asOf: body.metadata?.queryDate ?? now,
        fetchedAt: now,
        ttlSeconds,
        stale: false,
      };
      cache.set(cacheKey, { at: Date.now(), value });
      lastGood.set(cacheKey, value);
      return value;
    } catch (err) {
      // e.g. 403 for datasets outside the plan (free trial has no forward unlocks or fundraising)
      warning = (err as Error).message;
      const good = lastGood.get(cacheKey) as Sourced<T> | undefined;
      if (good) {
        // Not cached: the next question tries the live API again.
        return { ...good, stale: true, warning: `${warning}; showing the last good copy` };
      }
    }
  }

  const fixture = await readFixture<Envelope<T>>(...fixturePath);
  const value: Sourced<T> = {
    data: fixture?.data ?? empty,
    source: "sample",
    asOf: fixture?.metadata?.queryDate ?? now,
    fetchedAt: now,
    ttlSeconds,
    // Sample data in a demo without a key is labelled, not stale. A failed live call is stale.
    stale: warning !== undefined,
    warning: warning ? `${warning}; using sample data` : undefined,
  };
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

/** Freshness entry for any Tokenomist result. */
export function tokenomistFresh(res: Sourced<unknown>): Freshness {
  return makeFresh("Tokenomist", res.source, res.asOf, res.ttlSeconds, {
    fetchedAt: res.fetchedAt,
    stale: res.stale,
    note: res.warning,
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function listTokens(): Promise<Sourced<TokenListItem[]>> {
  return load<TokenListItem[]>("list", "/v5/token/list", ["tokenomist", "token-list.json"], [], TTL.tokenList);
}

/** Resolves a ticker or name ("sui", "WLD", "Avalanche") to a Tokenomist token. */
export async function findToken(query: string): Promise<{ token: TokenListItem | null; meta: Sourced<unknown> }> {
  const list = await listTokens();
  const q = query.trim().toLowerCase();
  // Several tokens can share a ticker; prefer the largest market cap.
  const matches = list.data
    .filter((t) => t.symbol.toLowerCase() === q || t.id.toLowerCase() === q || t.name.toLowerCase() === q)
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  return { token: matches[0] ?? null, meta: list };
}

export function getUnlockEvents(tokenId: string, start: string, end: string): Promise<Sourced<UnlockEvent[]>> {
  const qs = new URLSearchParams({ start, end, pageSize: "50" });
  return load<UnlockEvent[]>(
    `unlocks:${tokenId}:${start}:${end}`,
    `/v5/unlock/events/${encodeURIComponent(tokenId)}?${qs}`,
    ["tokenomist", "unlock-events", `${tokenId}.json`],
    [],
    TTL.unlockSchedule,
  ).then((res) => ({
    ...res,
    // Fixtures hold every event; apply the same window the live API applies.
    data: res.data.filter((e) => e.unlockDate.slice(0, 10) >= start && e.unlockDate.slice(0, 10) <= end),
  }));
}

export function getAllocations(tokenId: string): Promise<Sourced<AllocationsData | null>> {
  return load<AllocationsData | null>(
    `alloc:${tokenId}`,
    `/v5/allocations/${encodeURIComponent(tokenId)}`,
    ["tokenomist", "allocations", `${tokenId}.json`],
    null,
    TTL.allocations,
  );
}

export function getFundraising(tokenId: string): Promise<Sourced<FundraisingData | null>> {
  return load<FundraisingData | null>(
    `fund:${tokenId}`,
    `/v5/fundraising/token/${encodeURIComponent(tokenId)}`,
    ["tokenomist", "fundraising", `${tokenId}.json`],
    null,
    TTL.fundraising,
  );
}
