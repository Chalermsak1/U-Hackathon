import type { Metadata } from "next";
import { CalendarCard, NewsCard, OddsCard, PulseCard } from "@/components/chat/IntelCards";
import { LevelBadge, SourceBadge } from "@/components/chat/bits";
import { ExposureBars, InvestorBars } from "@/components/dashboard/Bars";
import { SupplyChart } from "@/components/dashboard/SupplyChart";
import { Icon } from "@/components/Icon";
import { now } from "@/lib/config";
import { compact, longDate, pct, shortDate, thb, usd } from "@/lib/format";
import { supplyForecast, type SupplyForecast } from "@/lib/forecast";
import { getEventCalendar } from "@/lib/intel/calendar";
import { searchNews } from "@/lib/intel/news";
import { getEventOdds } from "@/lib/intel/odds";
import { getMarketPulse } from "@/lib/intel/pulse";
import { investorPressure } from "@/lib/risk";
import { trackedTokens } from "@/lib/tokenomist";
import type { Citation } from "@/lib/types";
import { portfolioView } from "@/lib/views";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const t = now();
  const tokens = await trackedTokens();
  const symbols = tokens.data.map((x) => x.symbol);
  const [portfolio, calendar, news, odds, pulse, forecasts, investors] = await Promise.all([
    portfolioView(),
    getEventCalendar(60, { now: t }),
    searchNews({ query: "", symbols: [], days: 30, limit: 5, now: t }),
    getEventOdds("fed rates crypto bitcoin"),
    getMarketPulse(),
    Promise.all(symbols.map((s) => supplyForecast(s, 6, { now: t }))),
    Promise.all(symbols.map((s) => investorPressure(s))),
  ]);
  const today = new Date(t).toISOString().slice(0, 10);
  const nextEvent = calendar.find((e) => e.date >= today);
  const flagged = portfolio.rows.filter((r) => r.level === "high" || r.level === "medium");
  const holdings = Object.fromEntries(portfolio.rows.map((r) => [r.symbol, r.amount]));
  const citations: Citation[] = news.data.map((n, i) => ({ n: i + 1, title: n.summary, url: n.url, source: n.source }));
  const validForecasts = forecasts.filter((f): f is SupplyForecast => f !== null);
  validForecasts.sort((a, b) => (holdings[b.symbol] ? 1 : 0) - (holdings[a.symbol] ? 1 : 0) || b.pctOfCirculating - a.pctOfCirculating);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Portfolio &amp; markets</span>
          <h1>What could move your money</h1>
        </div>
        <span className="dim" style={{ fontSize: 13 }}>
          As of {longDate(portfolio.now)} · scores computed in code, sources on every card
        </span>
      </div>

      <div className="grid-4">
        <div className="kpi">
          <div className="label">Portfolio value</div>
          <div className="value">{thb(portfolio.totalThb)}</div>
          <div className="sub">
            {usd(portfolio.totalUsd)} · <SourceBadge source={portfolio.source} />
          </div>
        </div>
        <div className="kpi">
          <div className="label">Exposed to unlock pressure</div>
          <div className="value">{Math.round(portfolio.exposedPct)}%</div>
          <div className="sub">
            {flagged.length ? flagged.map((f) => f.symbol).join(", ") : "None"} at medium or high risk
          </div>
        </div>
        <div className="kpi">
          <div className="label">Next scheduled event</div>
          <div className="value" style={{ fontSize: "1.25rem" }}>
            {nextEvent ? (nextEvent.date === today ? "Today" : shortDate(nextEvent.date)) : "None"}
          </div>
          <div className="sub">{nextEvent?.title ?? "Nothing in the next 60 days"}</div>
        </div>
        <div className="kpi">
          <div className="label">Market mood</div>
          <div className="value">{pulse.data.sentiment ? pulse.data.sentiment.value : "n/a"}</div>
          <div className="sub">
            {pulse.data.sentiment ? `${pulse.data.sentiment.label} · Fear & Greed, ${shortDate(pulse.data.sentiment.date)}` : "No reading"}
          </div>
        </div>
      </div>

      <div className="dash-grid cols">
        <section className="card" aria-labelledby="exposure-h">
          <div className="card-title">
            <h2 id="exposure-h" style={{ fontSize: "1.15rem" }}>
              Holdings by unlock risk
            </h2>
            <span className="dim" style={{ fontSize: 13 }}>
              Bar = value · colour = U-Guard level
            </span>
          </div>
          <ExposureBars rows={portfolio.rows} />
          <details className="table-view">
            <summary>Show as table</summary>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th className="r">Amount</th>
                    <th className="r">Value</th>
                    <th>Unlock risk</th>
                    <th>Next event</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.rows.map((r) => (
                    <tr key={r.symbol}>
                      <td>
                        <b>{r.symbol}</b>
                      </td>
                      <td className="r">{compact(r.amount, 2)}</td>
                      <td className="r">{thb(r.valueThb)}</td>
                      <td>{r.level ? <LevelBadge level={r.level} prefix={r.score !== null ? String(r.score) : undefined} /> : <span className="dim">{r.note}</span>}</td>
                      <td className="dim">{r.card?.headline ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>

        <section className="card" aria-labelledby="supply-h">
          <div className="card-title">
            <h2 id="supply-h" style={{ fontSize: "1.15rem" }}>
              Supply forecast
            </h2>
            <span className="dim" style={{ fontSize: 13 }}>
              New tokens per month, from the vesting schedule
            </span>
          </div>
          <SupplyChart forecasts={validForecasts} holdings={holdings} />
        </section>
      </div>

      <div className="dash-grid cols">
        <section className="card" aria-labelledby="investors-h">
          <div className="card-title">
            <h2 id="investors-h" style={{ fontSize: "1.15rem" }}>
              Investor profit pressure
            </h2>
            <span className="dim" style={{ fontSize: 13 }}>
              Tokenomist fundraising
            </span>
          </div>
          <p className="dim" style={{ fontSize: 13, marginTop: -6 }}>
            Today&apos;s price ÷ what the latest priced funding round paid. Investors far in profit have more reason to sell when they unlock.
          </p>
          <InvestorBars rows={investors.filter((i): i is NonNullable<typeof i> => i !== null)} />
          <p className="source-line">
            From Tokenomist fundraising data (rounds, valuations, price per token). With a live key, the same view covers the full{" "}
            <a href="https://tokenomist.ai/fundraising/screener" target="_blank" rel="noopener noreferrer">
              fundraising screener
            </a>
            .
          </p>
        </section>

        <section className="card" aria-labelledby="events-h">
          <div className="card-title">
            <h2 id="events-h" style={{ fontSize: "1.15rem" }}>
              Scheduled events
            </h2>
            <span className="dim" style={{ fontSize: 13 }}>
              Next 60 days
            </span>
          </div>
          <CalendarCard events={calendar} today={today} />
        </section>
      </div>

      <section className="dash-grid" aria-labelledby="intel-h" style={{ marginTop: 24 }}>
        <div className="spread">
          <h2 id="intel-h" style={{ fontSize: "1.3rem", margin: 0 }} className="row">
            <Icon name="news" /> Market intel
          </h2>
          <span className="dim" style={{ fontSize: 13 }}>
            News, prediction markets and market readings: attributed, never our forecast
          </span>
        </div>
        <div className="dash-grid cols" style={{ marginTop: 0 }}>
          <NewsCard news={news} citations={citations} />
          <div className="stack" style={{ gap: 16 }}>
            <OddsCard odds={odds} />
            <PulseCard pulse={pulse} />
          </div>
        </div>
        <p className="source-line">
          Supply growth over the next 6 months:{" "}
          {validForecasts.map((f) => `${f.symbol} ${pct(f.pctOfCirculating)}`).join(" · ")}. Information, not investment advice.
        </p>
      </section>
    </>
  );
}
