"use client";

// Unlock schedule of the user's coins for the next 6 months, grouped by month, from the
// Tokenomist API. Every row says who receives the tokens and how much of the user's money sits
// in that coin, so the schedule reads as "what is coming for me", not a generic calendar.

import Link from "next/link";
import { useEffect, useState } from "react";
import { RECIPIENT_COLOR, RECIPIENT_LABEL } from "@/components/fx";
import { compact, shortDate, sourceTag, thb, usd } from "@/lib/format";
import type { HoldingsSchedule as Schedule } from "@/lib/schedule";

const monthOf = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export function HoldingsSchedule() {
  const [data, setData] = useState<Schedule | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/portfolio/schedule")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  const groups = (data?.rows ?? []).reduce<Record<string, Schedule["rows"]>>((acc, r) => {
    (acc[monthOf(r.date)] ??= []).push(r);
    return acc;
  }, {});

  return (
    <section className="panel schedule" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <h2>Unlock schedule of your coins · next {data?.months ?? 6} months</h2>
        <span className="total">{data ? `Tokenomist API · ${sourceTag({ mode: data.source, asOf: data.asOf })}` : ""}</span>
      </div>
      {failed && <p className="empty">Couldn&apos;t load the schedule. Reload to try again.</p>}
      {!data && !failed && <div className="pc-skeleton" style={{ height: 160 }} />}
      {data && data.rows.length === 0 && <p className="empty">None of your coins has a scheduled unlock in the next {data.months} months.</p>}
      {Object.entries(groups).map(([month, rows]) => (
        <div key={month} className="sched-month">
          <h3>
            {month}
            <small>
              {rows.length} event{rows.length === 1 ? "" : "s"} · {usd(rows.reduce((s, r) => s + (r.valueUsd ?? 0), 0))} unlocking
            </small>
          </h3>
          <div className="table-scroll">
            <table className="t-table sched-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Token</th>
                  <th>Type</th>
                  <th className="num">Amount</th>
                  <th className="num">% of circulating</th>
                  <th className="num">Value</th>
                  <th>Who receives it</th>
                  <th className="num">Your holding</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.symbol}-${r.date}-${i}`}>
                    <td>
                      <b>{shortDate(r.date)}</b>
                      {r.endDate ? <small className="muted"> → {shortDate(r.endDate)}</small> : null}
                    </td>
                    <td>
                      <Link href={`/terminal/tokens/${r.symbol}`} className="sym">
                        <i>{r.symbol.slice(0, 4)}</i>
                        {r.symbol}
                      </Link>
                    </td>
                    <td>
                      <span className={`pill ${r.kind === "cliff" ? "lv-medium" : "lv-low"}`}>{r.kind === "cliff" ? "Cliff" : "Daily release"}</span>
                    </td>
                    <td className="num">{compact(r.amount)}</td>
                    <td className="num" style={{ color: (r.pctCirc ?? 0) >= 1 ? "var(--coral)" : undefined }}>
                      {r.pctCirc === null ? "–" : `${r.pctCirc.toFixed(2)}%`}
                    </td>
                    <td className="num">{r.valueUsd === null ? "–" : usd(r.valueUsd)}</td>
                    <td>
                      <span className="sched-recips">
                        {r.recipients.map((p) => (
                          <span key={p.name} title={p.name}>
                            <i style={{ background: RECIPIENT_COLOR[p.class] }} />
                            {RECIPIENT_LABEL[p.class]} {Math.round(p.share * 100)}%
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="num">{thb(r.holdingValueThb)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {data && (
        <p className="note" style={{ margin: "8px 0 0" }}>
          {data.covered.length ? `Schedules for ${data.covered.join(", ")}` : ""}
          {data.noSchedule.length ? ` · no vesting schedule for ${data.noSchedule.join(", ")}` : ""} · scheduled in advance, not predicted
        </p>
      )}
    </section>
  );
}
