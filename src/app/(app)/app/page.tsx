import type { Metadata } from "next";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { LevelBadge, SourceBadge } from "@/components/chat/bits";
import { Icon } from "@/components/Icon";
import { getSession } from "@/lib/auth/session";
import { compact, thb, usd } from "@/lib/format";
import { integrationStatus, portfolioView } from "@/lib/views";

export const metadata: Metadata = { title: "Assistant" };
export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const [session, portfolio] = await Promise.all([getSession(), portfolioView()]);
  const status = integrationStatus();
  return (
    <div className="assistant">
      <div style={{ minWidth: 0 }}>
        {/* Phones: wallet as a scrollable strip above the chat. */}
        <div className="holdings-strip" aria-label="Your holdings">
          {portfolio.rows.map((h) => (
            <span key={h.symbol} className="badge" style={{ padding: "6px 12px", fontSize: 13 }}>
              <b style={{ color: "var(--text)" }}>{h.symbol}</b> {thb(h.valueThb)}
              {h.level ? <LevelBadge level={h.level} /> : null}
            </span>
          ))}
        </div>
        <ChatPanel variant="full" signedIn userName={session?.name.split(" ")[0]} />
      </div>

      <aside className="side" aria-label="Wallet and status">
        <section className="card wallet-card">
          <div className="card-title">
            <h3 className="row" style={{ gap: 8 }}>
              <Icon name="wallet" /> Wallet
            </h3>
            <SourceBadge source={portfolio.source} />
          </div>
          <div className="stat-big" style={{ fontSize: "1.9rem" }}>
            {thb(portfolio.totalThb)}
          </div>
          <p className="dim" style={{ fontSize: 13, marginBottom: 8 }}>
            {usd(portfolio.totalUsd)} · {Math.round(portfolio.exposedPct)}% in tokens with medium or high unlock pressure
          </p>
          {portfolio.rows.map((h) => (
            <div key={h.symbol} className="holding-row">
              <div>
                <strong>{h.symbol}</strong>{" "}
                <span className="amt">
                  {compact(h.amount, 2)} · {thb(h.valueThb)}
                </span>
              </div>
              {h.level ? <LevelBadge level={h.level} /> : <span className="badge">{h.note}</span>}
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-title">
            <h3 className="row" style={{ gap: 8 }}>
              <Icon name="plug" /> How this demo is wired
            </h3>
          </div>
          <ul className="status-list">
            {status.map((s) => (
              <li key={s.name}>
                <span>{s.name}</span>
                <span style={{ textAlign: "right", color: s.ok ? "var(--teal-2)" : "var(--text-2)" }}>{s.value}</span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
