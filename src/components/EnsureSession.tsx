"use client";

import { useEffect, useState, type ReactNode } from "react";

let pending: Promise<boolean> | null = null;

/** Signs this browser into the demo account once (no login wall on the Thai app). */
export function ensureSession(): Promise<boolean> {
  pending ??= (async () => {
    let ok = false;
    try {
      const me = await fetch("/api/auth/me", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
      ok = Boolean(me?.user);
      if (!ok) {
        const res = await fetch("/api/auth/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        ok = res.ok;
      }
    } catch {
      ok = false;
    }
    if (!ok) pending = null; // try again next time
    return ok;
  })();
  return pending;
}

/** Renders the page once a session exists; without demo sign-in it goes to /login. */
export function EnsureSession({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    ensureSession().then((ok) => {
      if (!alive) return;
      if (ok) setReady(true);
      else window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    });
    return () => {
      alive = false;
    };
  }, []);
  return ready ? <>{children}</> : <div aria-busy="true" style={{ minHeight: "100dvh" }} />;
}
