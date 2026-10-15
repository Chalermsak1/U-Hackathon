import Link from "next/link";

export function TopBar({ current, children }: { current: "home" | "app" | "terminal" | "logs"; children?: React.ReactNode }) {
  const link = (href: string, key: typeof current, label: string) => (
    <Link href={href} aria-current={current === key ? "page" : undefined}>
      {label}
    </Link>
  );
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark.svg" width={28} height={28} alt="" />
        U-Guard <small>ใน U-Bot</small>
      </Link>
      {children && <div className="badges">{children}</div>}
      <nav className="navlinks" aria-label="หลัก">
        {link("/", "home", "หน้าแรก")}
        {link("/app", "app", "แอป")}
        {link("/terminal", "terminal", "Terminal")}
      </nav>
    </header>
  );
}
