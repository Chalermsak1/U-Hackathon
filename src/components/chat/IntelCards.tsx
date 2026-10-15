import { shortDate, signedPct, usd, usdFull } from "@/lib/format";
import type { CalendarEvent, Citation, MarketPulse, NewsItem, OddsMarket, Sourced } from "@/lib/types";
import { Icon } from "../Icon";
import { SourceBadge } from "./bits";

export function NewsCard({ news, citations }: { news: Sourced<NewsItem[]>; citations: Citation[] }) {
  if (news.data.length === 0) return null;
  return (
    <section className="list-card" aria-label="Related news">
      <h4>
        <span className="row" style={{ gap: 6 }}>
          <Icon name="news" size={16} /> Related news
        </span>
        <SourceBadge source={news.source} asOf={news.asOf} />
      </h4>
      <ol className="news-list">
        {news.data.map((item) => {
          const c = citations.find((x) => x.url === item.url && x.title === item.summary);
          return (
            <li key={item.id}>
              <span className="cite" aria-hidden="true">
                {c?.n ?? "•"}
              </span>
              <span>
                <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text)" }}>
                  {item.summary}
                </a>
                <span className="src">
                  {item.source} · {item.date ? shortDate(item.date) : (item.dateLabel ?? "undated")}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function OddsCard({ odds }: { odds: Sourced<OddsMarket[]> }) {
  if (odds.data.length === 0) return null;
  return (
    <section className="list-card" aria-label="Prediction-market odds">
      <h4>
        <span className="row" style={{ gap: 6 }}>
          <Icon name="odds" size={16} /> What traders are pricing
        </span>
        <SourceBadge source={odds.source} asOf={odds.asOf} />
      </h4>
      <div className="stack" style={{ gap: 14 }}>
        {odds.data.slice(0, 2).map((m) => (
          <div key={m.id}>
            <p style={{ margin: "0 0 8px", fontSize: 14 }}>{m.question}</p>
            <div className="bars">
              {[...m.outcomes]
                .sort((a, b) => b.probability - a.probability)
                .map((o) => (
                  <div className="bar-row" key={o.name}>
                    <span className="label">{o.name}</span>
                    <span className="track" aria-hidden="true">
                      <span className="fill" style={{ display: "block", width: `${Math.max(2, o.probability * 100)}%` }} />
                    </span>
                    <span className="val">{Math.round(o.probability * 100)}%</span>
                  </div>
                ))}
            </div>
            <p className="dim" style={{ margin: "8px 0 0", fontSize: 12 }}>
              {m.provider}
              {m.reportedBy ? (
                <>
                  {" "}
                  via{" "}
                  <a href={m.reportedBy.url} target="_blank" rel="noopener noreferrer">
                    {m.reportedBy.name}
                  </a>
                </>
              ) : null}
              . Market pricing, not a U-Guard forecast.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PulseCard({ pulse }: { pulse: Sourced<MarketPulse> }) {
  const p = pulse.data;
  if (!p.btc && !p.sentiment) return null;
  return (
    <section className="list-card" aria-label="Market pulse">
      <h4>
        <span className="row" style={{ gap: 6 }}>
          <Icon name="pulse" size={16} /> Market pulse
        </span>
        <SourceBadge source={pulse.source} asOf={pulse.asOf} />
      </h4>
      <ul className="status-list">
        {p.btc ? (
          <li>
            <span>Bitcoin ({shortDate(p.btc.date)})</span>
            <span>
              <b>{usdFull(p.btc.priceUsd)}</b>
              {p.btc.change24hPct !== null ? <span className="dim"> {signedPct(p.btc.change24hPct)}</span> : null}
            </span>
          </li>
        ) : null}
        {p.sentiment ? (
          <li>
            <span>Fear &amp; Greed ({shortDate(p.sentiment.date)})</span>
            <span>
              <b>{p.sentiment.value}</b> <span className="dim">{p.sentiment.label}</span>
            </span>
          </li>
        ) : null}
        {p.etfFlows.map((f) => (
          <li key={f.asset + f.label}>
            <span>
              {f.asset} spot ETFs, {f.label}
            </span>
            <a href={f.source.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text)" }}>
              <b>{usd(f.netUsd)}</b>
            </a>
          </li>
        ))}
        {p.impliedMove ? (
          <li>
            <span>Options-implied {p.impliedMove.days}-day range</span>
            <span>
              <b>
                {usd(p.impliedMove.low)} to {usd(p.impliedMove.high)}
              </b>
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

export function CalendarCard({ events, today }: { events: CalendarEvent[]; today?: string }) {
  if (events.length === 0) return null;
  return (
    <section className="list-card" aria-label="Upcoming events">
      <h4>
        <span className="row" style={{ gap: 6 }}>
          <Icon name="calendar" size={16} /> Coming up
        </span>
      </h4>
      <ul className="status-list">
        {events.slice(0, 5).map((e) => (
          <li key={e.date + e.title}>
            <span>{e.date === today ? "Today" : shortDate(e.date)}</span>
            <span style={{ textAlign: "right" }}>{e.title}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
