import type { RecipientClass } from "./types";

// Pure (no server imports) so both the risk scorer and client pages can use it.
export function classifyRecipient(allocationName: string, standardName: string): RecipientClass {
  const name = allocationName.toLowerCase();
  if (/ecosystem|grant|liquidity|development fund|incentive/.test(name)) return "ecosystem";
  const std = standardName.toLowerCase();
  if (std.includes("team") || std.includes("founder")) return "team";
  if (std.includes("investor")) return "investor";
  if (std.includes("community")) return "community";
  if (std.includes("reserve")) return "reserve";
  return "other";
}
