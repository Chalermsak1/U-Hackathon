"use client";

import { useEffect, useState } from "react";

/**
 * First-visit splash (once per browser session, max ~1.2 s): the U shield draws itself
 * while "scanning" the calendar, and the count is real data. Skipped entirely for
 * reduced motion, and hidden before paint on repeat visits (see the inline script in
 * the root layout).
 */
export function Loader({ events }: { events: number }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setDone(true);
      try {
        sessionStorage.setItem("ug_seen", "1");
      } catch {
        // ignore
      }
    }, 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="loader" data-done={done ? "1" : undefined} aria-hidden="true">
      <div className="loader-inner">
        <svg viewBox="0 0 128 128">
          <path
            className="shield-fill"
            d="M32 30H52V62C52 70 57 76 64 76C71 76 76 70 76 62V30H96V64C96 84 82 98 64 104C46 98 32 84 32 64Z"
          />
          <path className="shield" d="M32 30H52V62C52 70 57 76 64 76C71 76 76 70 76 62V30H96V64C96 84 82 98 64 104C46 98 32 84 32 64Z" />
          <circle className="keyhole" cx="64" cy="45" r="7" />
          <path className="keyhole" d="M60.5 49L57.5 63H70.5L67.5 49Z" />
        </svg>
        <div className="status">Scanning the unlock calendar…</div>
        <div className="count">{events} scheduled events in the next 45 days</div>
      </div>
    </div>
  );
}
