import Link from "next/link";
import { Logo } from "../brand";

export function SiteNav({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="site-nav">
      <div className="container">
        <Logo />
        <nav aria-label="Main">
          <a href="/#how">How it works</a>
          <a href="/#signals">Signals</a>
          <Link href="/method">Method</Link>
        </nav>
        <div className="actions">
          {signedIn ? (
            <Link href="/app" className="btn btn-primary btn-sm">
              Open app
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-sm btn-ghost">
                Sign in
              </Link>
              <Link href="/login" className="btn btn-primary btn-sm">
                Try the demo
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="row" style={{ gap: 16 }}>
          <Logo />
          <span>Built for U-Bot at U-Hackathon 2026 · FLOW Summit Bangkok</span>
        </div>
        <p style={{ margin: 0 }}>
          U-Guard gives information, not investment advice. It never tells you to buy, sell or hold and never predicts prices. Data:
          Tokenomist (unlocks), CoinGecko (prices), GDELT (news), Polymarket (event odds). Prototype; not an official U-topia product.
        </p>
        <div className="row" style={{ gap: 16 }}>
          <Link href="/method">Method &amp; data</Link>
          <Link href="/login">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
