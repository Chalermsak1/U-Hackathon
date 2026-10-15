"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usd } from "@/lib/format";

interface Row {
  symbol: string;
  leadInvestors: string | null;
  totalInvestors: number | null;
  latestRound: string | null;
  marketCap: number;
  fdv: number;
  totalRaised: number | null;
  unlockedInvestorsUsd: number | null;
  pctInvestorsUnlocked: number | null;
  floatPct: number | null;
  analysed: boolean;
}

type SortKey = "fdv" | "marketCap" | "floatPct" | "totalRaised" | "pctInvestorsUnlocked";
const FILTERS = [
  { key: "all", th: "All" },
  { key: "lowfloat", th: "Float under 50%" },
  { key: "analysed", th: "Fully analysed" },
] as const;

function floatColor(p: number | null) {
  if (p === null) return "var(--slate)";
  return p < 40 ? "var(--coral)" : p < 70 ? "var(--amber)" : "var(--teal)";
}

// Supply screener: which tokens still have most of their supply waiting to come out.
export default function TokensPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [asOf, setAsOf] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "fdv", dir: -1 });
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  useEffect(() => {
    fetch("/api/screener")
      .then((r) => r.json())
      .then((b) => {
        setRows(b.rows ?? []);
        setAsOf(b.asOf ?? "");
      })
      .catch(() => setRows([]));
  }, []);

  const shown = useMemo(() => {
    const f = rows.filter((r) => (filter === "lowfloat" ? (r.floatPct ?? 100) < 50 : filter === "analysed" ? r.analysed : true));
    return [...f].sort((a, b) => ((a[sort.key] ?? -1) - (b[sort.key] ?? -1)) * sort.dir);
  }, [rows, sort, filter]);

  const head = (key: SortKey, label: string) => (
    <th className="num" aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }))}>
        {label} {sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}
      </button>
    </th>
  );

  return (
    <>
      <div className="page-title">
        <h1>Tokens · Supply screener</h1>
        <p>
          Sorted by FDV · Float = market cap ÷ FDV (lower means more supply still to come) · Tokenomist {asOf ? new Date(asOf).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div className="seg" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.key} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.th}
            </button>
          ))}
        </div>
        <span className="note" style={{ alignSelf: "center" }}>
          {shown.length} tokens · click a column to sort
        </span>
      </div>
      <div className="table-wrap">
        <table className="t-table">
          <thead>
            <tr>
              <th>Token</th>
              {head("marketCap", "Market cap")}
              {head("fdv", "FDV")}
              {head("floatPct", "Float")}
              {head("totalRaised", "Total raised")}
              {head("pctInvestorsUnlocked", "Investors unlocked")}
              <th>Latest round</th>
              <th>Lead investors</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.symbol}>
                <td>
                  <Link href={`/terminal/tokens/${r.symbol}`} className="sym">
                    <i>{r.symbol.slice(0, 4)}</i>
                    {r.symbol}
                    {r.analysed && <span className="pill lv-low" style={{ fontSize: 10.5, padding: "0 7px" }}>U-Guard</span>}
                  </Link>
                </td>
                <td className="num">{usd(r.marketCap)}</td>
                <td className="num">{usd(r.fdv)}</td>
                <td className="num">
                  <span className="floatbar">
                    <span>
                      <i style={{ width: `${r.floatPct ?? 0}%`, background: floatColor(r.floatPct) }} />
                    </span>
                    {r.floatPct === null ? "–" : `${r.floatPct.toFixed(0)}%`}
                  </span>
                </td>
                <td className="num">{r.totalRaised === null ? "–" : usd(r.totalRaised)}</td>
                <td className="num">{r.pctInvestorsUnlocked === null ? "–" : `${r.pctInvestorsUnlocked}%`}</td>
                <td>{r.latestRound ?? "–"}</td>
                <td className="note">{r.leadInvestors ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note" style={{ marginTop: 10 }}>
        Decision support, not investment advice · tokens with the U-Guard badge have a full unlock schedule for risk analysis
      </p>
    </>
  );
}
