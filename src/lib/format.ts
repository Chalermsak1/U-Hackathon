// Formatting helpers shared by the server (agent replies) and the client (UI).

export function compact(n: number, digits = 1): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(digits)}K`;
  return n.toFixed(abs < 10 ? 2 : 0);
}

export function usd(n: number): string {
  return `$${compact(n)}`;
}

export function thb(n: number): string {
  return `฿${Math.round(n).toLocaleString("en-US")}`;
}

export function pct(n: number, digits = 2): string {
  return `${n.toFixed(digits)}%`;
}

/** "24 ต.ค." — day and month only, so the Buddhist-era year never confuses anyone. */
export function thaiDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function daysBetween(fromMs: number, iso: string): number {
  return Math.ceil((new Date(iso).getTime() - fromMs) / 86_400_000);
}

export const LEVEL_TH: Record<string, string> = {
  high: "เสี่ยงสูง",
  medium: "เสี่ยงปานกลาง",
  low: "เสี่ยงต่ำ",
  none: "ไม่มี unlock ใกล้นี้",
};
