// Replaces the SAMPLE fixtures with live Tokenomist data, so the stage demo runs on
// real numbers even if the venue Wi-Fi drops.
//
//   npm run snapshot -- SUI WLD AVAX
//
// Needs TOKENOMIST_API_KEY in .env. Endpoints outside your plan (e.g. fundraising on the
// free trial) are skipped and keep their sample file.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const key = process.env.TOKENOMIST_API_KEY;
const base = process.env.TOKENOMIST_BASE_URL || "https://api.tokenomist.ai";
const symbols = process.argv.slice(2).map((s) => s.toUpperCase());
const root = path.join(process.cwd(), "data", "fixtures", "tokenomist");

if (!key) {
  console.error("TOKENOMIST_API_KEY is not set (put it in .env)");
  process.exit(1);
}
if (symbols.length === 0) {
  console.error("Usage: npm run snapshot -- SUI WLD AVAX");
  process.exit(1);
}

async function get(p) {
  const res = await fetch(base + p, { headers: { "x-api-key": key } });
  if (!res.ok) throw new Error(`${res.status} ${p.split("?")[0]}`);
  return res.json();
}

async function save(rel, body) {
  const file = path.join(root, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(body, null, 2));
  console.log("  wrote", path.relative(process.cwd(), file));
}

const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

const list = await get("/v5/token/list");
const picked = [];
for (const sym of symbols) {
  const token = list.data
    .filter((t) => t.symbol.toUpperCase() === sym)
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))[0];
  if (!token) {
    console.warn(`! ${sym} not found in Tokenomist token list`);
    continue;
  }
  picked.push(token);
}
await save("token-list.json", { ...list, data: picked });

for (const token of picked) {
  console.log(`${token.symbol} (${token.id})`);
  const jobs = [
    [`unlock-events/${token.id}.json`, `/v5/unlock/events/${token.id}?start=${day(-7)}&end=${day(90)}&pageSize=50`],
    [`allocations/${token.id}.json`, `/v5/allocations/${token.id}`],
    [`fundraising/${token.id}.json`, `/v5/fundraising/token/${token.id}`],
  ];
  for (const [rel, p] of jobs) {
    try {
      await save(rel, await get(p));
    } catch (err) {
      console.warn(`  skipped ${rel}: ${err.message}`);
    }
  }
}
console.log("\nDone. Remember to add the same tickers to data/fixtures/market.json and portfolio.json.");
