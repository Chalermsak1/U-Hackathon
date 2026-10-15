// Run log: one JSON line per agent run / protection receipt, in logs/YYYY-MM-DD.jsonl.
// Lets the team replay what the agent did during the stage demo. Never throws: on a
// read-only filesystem (e.g. serverless) it only prints to the console.

import { appendFile, mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { AgentResult } from "./types";

const LOG_DIR = path.join(process.cwd(), process.env.LOG_DIR || "logs");

export type LogEntry =
  | {
      type: "agent";
      route: string;
      mode: AgentResult["mode"];
      ms: number;
      message: string;
      cards: { symbol: string; level: string; score: number }[];
      proposals: number;
      trace: { tool: string; ms: number; ok: boolean; summary: string }[];
      note?: string;
    }
  | { type: "protect"; proposalId: string; symbol: string; decision: string; mode: string; txHash: string | null }
  | { type: "error"; route: string; message: string };

export async function writeLog(entry: LogEntry): Promise<void> {
  const line = { ts: new Date().toISOString(), ...entry };
  const brief =
    entry.type === "agent"
      ? `${entry.mode} ${entry.ms}ms ${entry.trace.map((t) => t.tool).join(">") || "-"}`
      : entry.type === "protect"
        ? `${entry.decision} ${entry.symbol} ${entry.mode}`
        : entry.message;
  console.info(`[u-guard] ${entry.type} ${brief}`);
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(path.join(LOG_DIR, `${line.ts.slice(0, 10)}.jsonl`), JSON.stringify(line) + "\n");
  } catch {
    // read-only filesystem: console output above is the log
  }
}

export async function readRecentLogs(limit = 50): Promise<unknown[]> {
  try {
    const files = (await readdir(LOG_DIR)).filter((f) => f.endsWith(".jsonl")).sort().slice(-2);
    const lines: string[] = [];
    for (const f of files) lines.push(...(await readFile(path.join(LOG_DIR, f), "utf8")).split("\n").filter(Boolean));
    return lines.slice(-limit).reverse().map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}
