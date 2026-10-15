"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "../Icon";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/assistant", label: "Assistant", icon: "chat" },
  { href: "/dashboard", label: "Dashboard", icon: "chart" },
  { href: "/method", label: "Method", icon: "book" },
];

export function AppTabs() {
  const pathname = usePathname();
  return (
    <nav className="app-tabs" aria-label="App">
      {LINKS.slice(0, 2).map((l) => (
        <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="App">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} aria-current={pathname === l.href ? "page" : undefined}>
          <Icon name={l.icon} size={20} />
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function SignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label="Sign out"
      title="Sign out"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        router.push("/login");
        router.refresh();
      }}
    >
      <Icon name="logout" />
    </button>
  );
}
