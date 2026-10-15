"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

const NAV = [
  {
    label: "สำรวจ",
    items: [
      { href: "/terminal", icon: "home", th: "ภาพรวม" },
      { href: "/terminal/agent", icon: "spark", th: "AI Agent" },
      { href: "/terminal/tokens", icon: "coins", th: "เหรียญ" },
      { href: "/terminal/unlocks", icon: "calendar", th: "ปฏิทินปลดล็อก" },
    ],
  },
  {
    label: "ของฉัน",
    items: [
      { href: "/terminal/portfolio", icon: "wallet", th: "พอร์ต" },
      { href: "/terminal/alerts", icon: "bell", th: "การแจ้งเตือน" },
    ],
  },
  {
    label: "อื่นๆ",
    items: [
      { href: "/app", icon: "phone", th: "แอป U-topia (มือถือ)" },
      { href: "/#method", icon: "book", th: "วิธีคิดคะแนน" },
    ],
  },
];

const KNOWN = ["ARB", "WLD", "AVAX", "SOL", "SUI", "ENA", "ONDO", "LINK", "UNI", "NEAR", "TAO", "WLFI", "PUMP", "LIT", "DOT", "AAVE", "ADA", "OKB", "BGB", "MNT"];

// App frame for /terminal/*: collapsible sidebar (⌘B) and a search box (⌘K) that opens a
// token page for a ticker or sends anything else to the AI Agent.
export function TerminalShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);

  // On phones the nav is one swipeable row; keep the current page's link in view.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const n = nav.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    nav.scrollLeft += a.left - n.left - (n.width - a.width) / 2;
  }, [path]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("ug-sidebar") === "collapsed");
    } catch {
      // storage blocked: keep the default
    }
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((c) => {
          try {
            localStorage.setItem("ug-sidebar", c ? "open" : "collapsed");
          } catch {
            // ignore
          }
          return !c;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const ticker = q.replace(/^\$/, "").toUpperCase();
    setQuery("");
    if (KNOWN.includes(ticker)) router.push(`/terminal/tokens/${ticker}`);
    else router.push(`/terminal/agent?q=${encodeURIComponent(q)}`);
  }

  const isActive = (href: string) => (href === "/terminal" ? path === href : path.startsWith(href));

  return (
    <div className={`term ${collapsed ? "term-collapsed" : ""}`}>
      <aside className="term-side" aria-label="เมนู">
        <Link href="/" className="term-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.svg" width={30} height={30} alt="" />
          <span>
            U-Guard <small>Terminal</small>
          </span>
        </Link>
        <nav ref={navRef}>
          {NAV.map((g) => (
            <div key={g.label} className="term-group">
              <p className="term-group-label">{g.label}</p>
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} className="term-link" aria-current={isActive(it.href) ? "page" : undefined} title={it.th}>
                  <Icon name={it.icon} />
                  <span>{it.th}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <button
          className="term-link term-collapse"
          onClick={() => setCollapsed((c) => !c)}
          title="ย่อ/ขยายเมนู (⌘B)"
          aria-label="ย่อหรือขยายเมนู"
        >
          <Icon name="collapse" />
          <span>ย่อเมนู</span>
          <kbd>⌘B</kbd>
        </button>
      </aside>

      <div className="term-main">
        <header className="term-top">
          <form className="term-search" onSubmit={submit} role="search">
            <Icon name="search" size={16} />
            <label htmlFor="term-q" className="sr-only">
              ค้นหาเหรียญหรือถาม U-Guard
            </label>
            <input
              id="term-q"
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเหรียญ (ARB) หรือถาม U-Guard…"
              autoComplete="off"
            />
            <kbd>⌘K</kbd>
          </form>
          <span className="pill lv-medium" title="จะเป็นข้อมูลสดเมื่อตั้ง TOKENOMIST_API_KEY">
            ข้อมูลตัวอย่าง + Tokenomist 15 ต.ค.
          </span>
          <Link href="/app" className="btn btn-sm">
            เปิดแอปมือถือ
          </Link>
        </header>
        <main className="term-content">{children}</main>
      </div>
    </div>
  );
}
