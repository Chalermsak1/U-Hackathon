// Formatting helpers shared by the server (agent replies) and the client (UI).

export function compact(n: number, digits = 1): string {
  const abs = Math.abs(n);
  const fixed = (v: number) => {
    const s = v.toFixed(digits);
    return digits > 0 ? s.replace(/\.?0+$/, "") : s;
  };
  if (abs >= 1e12) return `${fixed(n / 1e12)}T`;
  if (abs >= 1e9) return `${fixed(n / 1e9)}B`;
  if (abs >= 1e6) return `${fixed(n / 1e6)}M`;
  if (abs >= 1e3) return `${fixed(n / 1e3)}K`;
  if (n === 0) return "0";
  return abs < 10 ? fixed(n).replace(/^-?0$/, "0") : n.toFixed(0);
}

export function usd(n: number, digits = 1): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${compact(Math.abs(n), digits)}`;
}

export function usdFull(n: number): string {
  const maximumFractionDigits = Math.abs(n) < 1 ? 4 : Math.abs(n) < 100 ? 2 : 0;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits })}`;
}

export function thb(n: number): string {
  return `฿${Math.round(n).toLocaleString("en-US")}`;
}

export function pct(n: number, digits = 2): string {
  return `${n.toFixed(digits)}%`;
}

export function signedPct(n: number, digits = 1): string {
  return `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
}

/** "Oct 16" (UTC), so a server in any timezone renders the same date. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** "Oct 16, 2026" */
export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Whole days from `fromMs` to the date (UTC day boundaries); negative when it has passed. */
export function daysBetween(fromMs: number, iso: string): number {
  const dayMs = 86_400_000;
  const fromDay = Math.floor(fromMs / dayMs);
  const toDay = Math.floor(new Date(iso).getTime() / dayMs);
  return toDay - fromDay;
}

export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export const LEVEL_LABEL: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No unlock",
};
