"use client";

import type { RiskLevel } from "@/lib/types";

// The U-Guard mark with its motion language (spec in UI-REVIEW.md, "Logo motion"):
//   draw-in  the shield traces its outline, fills, then the eyes open and the smile draws
//   blink    every few seconds while idle
//   look     the face shifts toward whatever U-Guard is checking
//   react    the ring takes the risk colour, a ripple goes out, and on a high
//            risk the shield lifts once ("shield up")
// Each layer is its own SVG element so a redesigned logo can keep the same motion.
// All motion is CSS (gm-*), so prefers-reduced-motion turns it off in one place.

const LEVEL_COLOR: Record<RiskLevel | "idle", string> = {
  idle: "#2DD4BF",
  none: "#94A3B8",
  low: "#2DD4BF",
  medium: "#FBBF24",
  high: "#FB7151",
};

export const SHIELD_PATH = "M32 30H52V62C52 70 57 76 64 76C71 76 76 70 76 62V30H96V64C96 84 82 98 64 104C46 98 32 84 32 64Z";

export function GuardMark({
  level = "idle",
  look = { x: 0, y: 0 },
  react = 0,
  size = 120,
}: {
  level?: RiskLevel | "idle";
  /** face offset in viewBox units, clamped to ±4 */
  look?: { x: number; y: number };
  /** bump this to replay the reaction (ripple, plus "shield up" on high risk) */
  react?: number;
  size?: number;
}) {
  const clamp = (n: number) => Math.max(-4, Math.min(4, n));
  const bump = react > 0 && level === "high" ? (react % 2 ? "gm-up-a" : "gm-up-b") : "";
  return (
    <svg
      className="gm"
      width={size}
      height={size}
      viewBox="0 0 128 128"
      aria-hidden="true"
      style={{ "--gm-color": LEVEL_COLOR[level] } as React.CSSProperties}
    >
      <rect className="gm-bg" x="4" y="4" width="120" height="120" rx="32" />
      {react > 0 && <rect key={react} className="gm-ripple" x="4" y="4" width="120" height="120" rx="32" />}
      <rect className="gm-ring" x="4" y="4" width="120" height="120" rx="32" />
      <g className={`gm-body ${bump}`}>
        <path className="gm-fill" d={SHIELD_PATH} />
        <path className="gm-outline" d={SHIELD_PATH} pathLength={1} />
        <g className="gm-face" style={{ transform: `translate(${clamp(look.x)}px, ${clamp(look.y)}px)` }}>
          <rect className="gm-eye" x="55" y="42" width="6" height="11" rx="3" />
          <rect className="gm-eye" x="67" y="42" width="6" height="11" rx="3" />
          <path className="gm-smile" d="M55 87Q64 94 73 87" pathLength={1} />
        </g>
      </g>
    </svg>
  );
}
