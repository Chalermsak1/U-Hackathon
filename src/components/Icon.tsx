// Small inline icon set (stroke icons, 24px grid). No icon library needed.

const PATHS: Record<string, string> = {
  shield: "M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6l7-3z",
  check: "M5 12.5l4.2 4.2L19 7",
  x: "M6 6l12 12M18 6L6 18",
  send: "M4 12l16-8-6 16-2.5-6.5L4 12z",
  speaker: "M5 9v6h4l5 4V5L9 9H5zM17.5 8.5a5 5 0 010 7M20 6a8.5 8.5 0 010 12",
  stop: "M7 7h10v10H7z",
  chat: "M4 5h16v11H9l-5 4V5z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  book: "M5 4h10a4 4 0 014 4v12H9a4 4 0 01-4-4V4zM5 16a4 4 0 014-4h10",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  clock: "M12 7v5l3 2M12 21a9 9 0 110-18 9 9 0 010 18z",
  unlock: "M7 11V7a5 5 0 019.6-2M5 11h14v10H5z",
  news: "M4 5h13v14H6a2 2 0 01-2-2V5zM17 9h3v8a2 2 0 01-2 2M8 9h5M8 13h5",
  odds: "M4 20l5-6 4 3 7-9M15 8h5v5",
  pulse: "M3 12h4l2-6 4 12 2-6h6",
  wallet: "M4 7h15v12H4a1 1 0 01-1-1V8a1 1 0 011-1zM4 7l11-3v3M16 13h1",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6",
  thumbsUp: "M7 21H4V10h3M7 10l4-7a2 2 0 012 2v4h5.5a2 2 0 012 2.3l-1.2 7A2 2 0 0117.3 20H7",
  thumbsDown: "M7 3H4v11h3M7 14l4 7a2 2 0 002-2v-4h5.5a2 2 0 002-2.3l-1.2-7A2 2 0 0017.3 4H7",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  plug: "M9 3v5M15 3v5M7 8h10v3a5 5 0 01-10 0V8zM12 16v5",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 018 0v4",
  info: "M12 11v6M12 7.5v.5M12 21a9 9 0 110-18 9 9 0 010 18z",
  scan: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M4 12h16",
  calendar: "M4 6h16v14H4zM4 10h16M9 3v5M15 3v5",
  close: "M6 6l12 12M18 6L6 18",
};

export function Icon({ name, size = 18, strokeWidth = 1.8, title }: { name: keyof typeof PATHS; size?: number; strokeWidth?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}

export type IconName = keyof typeof PATHS;
