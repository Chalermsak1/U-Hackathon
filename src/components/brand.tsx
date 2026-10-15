import Link from "next/link";

/** U-shaped shield guarding a keyhole (same geometry as public/brand/logo-mark.svg). */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
      <rect x="4" y="4" width="120" height="120" rx="32" fill="#0B1426" />
      <rect x="4.5" y="4.5" width="119" height="119" rx="31.5" fill="none" stroke="rgba(94,234,212,0.35)" />
      <path d="M32 30H52V62C52 70 57 76 64 76C71 76 76 70 76 62V30H96V64C96 84 82 98 64 104C46 98 32 84 32 64Z" fill="#2DD4BF" />
      <circle cx="64" cy="45" r="7" fill="#FBBF24" />
      <path d="M60.5 49L57.5 63H70.5L67.5 49Z" fill="#FBBF24" />
    </svg>
  );
}

/** U-Bot's face: the same U shield, with eyes and a smile. */
export function BotFace({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
      <rect x="4" y="4" width="120" height="120" rx="32" fill="#0B1426" />
      <path d="M32 30H52V62C52 70 57 76 64 76C71 76 76 70 76 62V30H96V64C96 84 82 98 64 104C46 98 32 84 32 64Z" fill="#2DD4BF" />
      <rect x="55" y="42" width="6" height="11" rx="3" fill="#5EEAD4" />
      <rect x="67" y="42" width="6" height="11" rx="3" fill="#5EEAD4" />
      <path d="M55 87Q64 94 73 87" fill="none" stroke="#0B1426" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", tag }: { href?: string; tag?: string }) {
  return (
    <Link href={href} className="logo" aria-label="U-Guard home">
      <LogoMark />
      <span>U-Guard</span>
      {tag ? <span className="tag">{tag}</span> : null}
    </Link>
  );
}

export function Avatar({ level, thinking }: { level?: string | null; thinking?: boolean }) {
  return (
    <span className="avatar" data-level={level ?? undefined} data-state={thinking ? "thinking" : undefined}>
      <BotFace />
    </span>
  );
}
