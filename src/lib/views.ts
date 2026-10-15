// Server-side view models for pages (portfolio with risk per holding, integration status).

import { activeProvider } from "./agent";
import { config, now } from "./config";
import { getHoldings } from "./portfolio";
import { assessUnlockRisk } from "./risk";
import type { DataSource, Holding, RiskCard, RiskLevel } from "./types";
import { voiceConfigured } from "./voice";

export interface HoldingView extends Holding {
  level: RiskLevel | null;
  score: number | null;
  card: RiskCard | null;
  note: string | null;
}

export async function portfolioView() {
  const t = now();
  const holdings = await getHoldings();
  const rows: HoldingView[] = await Promise.all(
    holdings.map(async (h) => {
      const r = await assessUnlockRisk(h.symbol, null, { now: t });
      return r.ok
        ? { ...h, level: r.card.level, score: r.card.score, card: r.card, note: null }
        : { ...h, level: null, score: null, card: null, note: r.kind === "no_vesting" ? "No vesting unlocks" : "Not in dataset" };
    }),
  );
  rows.sort((a, b) => b.valueUsd - a.valueUsd);
  const totalUsd = rows.reduce((s, r) => s + r.valueUsd, 0);
  const totalThb = rows.reduce((s, r) => s + r.valueThb, 0);
  const exposedUsd = rows.filter((r) => r.level === "high" || r.level === "medium").reduce((s, r) => s + r.valueUsd, 0);
  const sources = new Set<DataSource>(rows.map((r) => r.source));
  return {
    rows,
    totalUsd,
    totalThb,
    exposedUsd,
    exposedPct: totalUsd > 0 ? (exposedUsd / totalUsd) * 100 : 0,
    source: (sources.has("sample") ? "sample" : sources.has("snapshot") ? "snapshot" : "live") as DataSource,
    now: new Date(t).toISOString(),
  };
}

export function integrationStatus(): { name: string; value: string; ok: boolean }[] {
  const p = activeProvider();
  return [
    { name: "U-Bot", value: "Simulated: this chat stands in", ok: false },
    { name: "MCP endpoint", value: "/api/mcp ready", ok: true },
    { name: "Agent model", value: p.provider === "rules" ? "Rules engine (no LLM key)" : `${p.label} · ${p.model}`, ok: p.provider !== "rules" },
    { name: "Tokenomist", value: config.tokenomist.apiKey ? "Live API" : "Offline snapshot", ok: Boolean(config.tokenomist.apiKey) },
    { name: "News & odds", value: config.intel.news === "live" ? "Live (GDELT, Polymarket)" : "Dated snapshot", ok: config.intel.news === "live" },
    { name: "Voice", value: voiceConfigured() ? "ElevenLabs" : "Browser voice", ok: voiceConfigured() },
    { name: "Avalanche", value: config.avalanche.demoPrivateKey ? "Fuji testnet" : "Simulated receipts", ok: Boolean(config.avalanche.demoPrivateKey) },
  ];
}
