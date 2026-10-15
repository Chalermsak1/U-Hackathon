// Client-side hand-off to the printable /report page. The browser's "Save as PDF" lays out
// Thai correctly (vowels and tone marks), which server-side PDF libraries often don't.

import type { AgentResult } from "./types";

export const REPORT_KEY = "u-guard-report";

/** What the report needs; a full agent result also fits (the portfolio page builds a partial one). */
export type ReportResult = Pick<AgentResult, "reply" | "cards" | "proposals" | "trace"> & Partial<AgentResult>;

export interface ReportData {
  question: string;
  result: ReportResult;
  at: string;
}

export function openReport(question: string, result: ReportResult) {
  try {
    sessionStorage.setItem(REPORT_KEY, JSON.stringify({ question, result, at: new Date().toISOString() } satisfies ReportData));
  } catch {
    // storage blocked: the report page explains how to retry
  }
  window.open("/report", "_blank", "noopener");
}

export function readReport(): ReportData | null {
  try {
    const raw = sessionStorage.getItem(REPORT_KEY);
    return raw ? (JSON.parse(raw) as ReportData) : null;
  } catch {
    return null;
  }
}
