import type { RiskLevel } from "@/lib/types";

const RING: Record<RiskLevel | "idle", string> = {
  idle: "#2DD4BF",
  low: "#2DD4BF",
  none: "#94A3B8",
  medium: "#FBBF24",
  high: "#FB7151",
};

/** U-Guard: a U-shaped shield. The ring shows the risk level of the answer; dashed and spinning while thinking. */
export function Avatar({ level = "idle", thinking = false, size = 32 }: { level?: RiskLevel | "idle"; thinking?: boolean; size?: number }) {
  const color = thinking ? "#5EEAD4" : RING[level];
  return (
    <svg className="avatar" width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
      <rect x="4" y="4" width="120" height="120" rx="32" fill="#0B1426" />
      <rect
        className={thinking ? "ring-think" : undefined}
        x="4"
        y="4"
        width="120"
        height="120"
        rx="32"
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={thinking ? "40 22" : undefined}
      />
      <path d="M32 30H52V62C52 70 57 76 64 76C71 76 76 70 76 62V30H96V64C96 84 82 98 64 104C46 98 32 84 32 64Z" fill="#2DD4BF" />
      <rect className="eye" x="55" y="42" width="6" height="11" rx="3" fill="#5EEAD4" />
      <rect className="eye" x="67" y="42" width="6" height="11" rx="3" fill="#5EEAD4" />
      <path d="M55 87Q64 94 73 87" fill="none" stroke="#0B1426" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** Highest risk level among the cards of one answer, for the avatar ring. */
export function topLevel(levels: RiskLevel[]): RiskLevel | "idle" {
  for (const l of ["high", "medium", "low", "none"] as const) if (levels.includes(l)) return l;
  return "idle";
}
