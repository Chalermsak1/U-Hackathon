// Who receives an unlock. Pure (no server imports), so client pages can use it too.

import type { RecipientClass } from "./types";

export function classifyRecipient(allocationName: string, standardName: string): RecipientClass {
  const name = allocationName.toLowerCase();
  const std = standardName.toLowerCase();
  if (/ecosystem|grant|liquidity|development fund|incentive/.test(name) || std.includes("ecosystem")) return "ecosystem";
  if (std.includes("team") || std.includes("founder")) return "team";
  if (std.includes("investor")) return "investor";
  if (std.includes("community")) return "community";
  if (std.includes("reserve") || /foundation|treasury/.test(name)) return "reserve";
  return "other";
}
